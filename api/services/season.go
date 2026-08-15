package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
	"strconv"
	"strings"
	"time"
)

func (s *PredictballAPIService) RetireSeason(ctx context.Context, compCode string, season string) error {
	if strings.TrimSpace(season) == "" {
		return fmt.Errorf("season parameter is required")
	}

	compID, err := s.ResolveCompetitionID(ctx, compCode)
	if err != nil {
		return fmt.Errorf("failed to resolve competition ID: %w", err)
	}

	comp, err := s.GetCompetitionDetail(ctx, compCode)
	resolvedSeason := season
	if err == nil && comp != nil {
		resolvedSeason = resolveSeasonString(comp, season)
	}

	archivedSeasons := getArchivedSeasonIDs(compID)
	if archivedSeasons[resolvedSeason] || archivedSeasons[season] {
		return fmt.Errorf("season %s for competition %s is already retired", resolvedSeason, compCode)
	}

	schedule, err := s.validateSeasonRetirement(ctx, compCode, resolvedSeason)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	safeCompID := sanitizeSegment(compID)
	leaguesDir := filepath.Join("data", "competitions", safeCompID, "leagues")

	globalLeague, userPointsMap, err := s.archiveGlobalLeague(leaguesDir, resolvedSeason)
	if err != nil {
		return err
	}

	if err := s.resetGlobalLeague(leaguesDir, globalLeague); err != nil {
		return err
	}

	if err := s.prunePrivateLeagues(leaguesDir, userPointsMap); err != nil {
		return err
	}

	if err := s.pruneUserLeaguesMap(userPointsMap, compID); err != nil {
		return err
	}

	if err := s.purgeUserPredictionsAndPowerups(compID); err != nil {
		return err
	}

	s.purgeMatchCache(schedule)

	return nil
}

func (s *PredictballAPIService) validateSeasonRetirement(ctx context.Context, compCode string, season string) ([]models.Match, error) {
	comp, _ := s.GetCompetitionDetail(ctx, compCode)
	if comp != nil {
		targetSeason := comp.CurrentSeason
		for _, sz := range comp.Seasons {
			if fmt.Sprint(sz.ID) == season || (len(sz.StartDate) >= 4 && sz.StartDate[:4] == season) {
				targetSeason = sz
				break
			}
		}
		if targetSeason.IsRetired {
			return nil, fmt.Errorf("season %s for competition %s is already retired", season, compCode)
		}
		if targetSeason.EndDate != "" {
			if t, err := time.Parse("2006-01-02", targetSeason.EndDate); err == nil {
				endOfDay := t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
				if time.Now().Before(endOfDay) {
					return nil, fmt.Errorf("cannot retire season %s: the season has not finished yet (scheduled end date: %s)", season, targetSeason.EndDate)
				}
			}
		}
	}

	schedule, err := s.GetMatchSchedule(ctx, compCode, season)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch match schedule for season validation: %w", err)
	}

	if len(schedule) == 0 {
		return nil, fmt.Errorf("no scheduled matches found for competition %s season %s", compCode, season)
	}

	var lastMatchTime time.Time
	for _, m := range schedule {
		if m.StartTime.After(lastMatchTime) {
			lastMatchTime = m.StartTime
		}
	}

	if time.Now().Before(lastMatchTime) {
		return nil, fmt.Errorf("cannot retire season: the last match is scheduled in the future (%s)", lastMatchTime.Format(time.RFC3339))
	}

	return schedule, nil
}

func (s *PredictballAPIService) archiveGlobalLeague(leaguesDir string, season string) (models.GlobalLeague, map[int]int, error) {
	globalLeaguePath := filepath.Join(leaguesDir, "0.json")

	data, err := os.ReadFile(globalLeaguePath)
	if err != nil {
		return models.GlobalLeague{}, nil, fmt.Errorf("global league (0.json) not found: %w", err)
	}

	var globalLeague models.GlobalLeague
	if err := json.Unmarshal(data, &globalLeague); err != nil {
		return models.GlobalLeague{}, nil, fmt.Errorf("failed to parse global league data: %w", err)
	}

	archiveDir := filepath.Join(leaguesDir, "archive")
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return models.GlobalLeague{}, nil, fmt.Errorf("failed to create archive directory: %w", err)
	}

	archivedGlobalPath := filepath.Join(archiveDir, fmt.Sprintf("0_%s.json", season))
	if err := os.WriteFile(archivedGlobalPath, data, 0644); err != nil {
		return models.GlobalLeague{}, nil, fmt.Errorf("failed to write archived global league: %w", err)
	}

	userPointsMap := make(map[int]int)
	for _, u := range globalLeague.Users {
		userPointsMap[u.UserID] = u.Points
	}

	return globalLeague, userPointsMap, nil
}

func (s *PredictballAPIService) resetGlobalLeague(leaguesDir string, globalLeague models.GlobalLeague) error {
	var preservedGlobalUsers []models.LeagueUser
	for _, u := range globalLeague.Users {
		if u.Points > 0 {
			u.Points = 0
			preservedGlobalUsers = append(preservedGlobalUsers, u)
		}
	}
	globalLeague.Users = preservedGlobalUsers

	newGlobalData, err := json.MarshalIndent(globalLeague, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode reset global league: %w", err)
	}

	globalLeaguePath := filepath.Join(leaguesDir, "0.json")
	if err := os.WriteFile(globalLeaguePath, newGlobalData, 0644); err != nil {
		return fmt.Errorf("failed to save reset global league: %w", err)
	}

	return nil
}

func (s *PredictballAPIService) prunePrivateLeagues(leaguesDir string, userPointsMap map[int]int) error {
	files, err := os.ReadDir(leaguesDir)
	if err != nil {
		return nil
	}

	for _, f := range files {
		if f.IsDir() || f.Name() == "0.json" || !strings.HasSuffix(f.Name(), ".json") {
			continue
		}
		leagueFilePath := filepath.Join(leaguesDir, f.Name())
		leagueData, err := os.ReadFile(leagueFilePath)
		if err != nil {
			continue
		}

		var leagueObj map[string]any
		if err := json.Unmarshal(leagueData, &leagueObj); err != nil {
			continue
		}

		updated := false
		if rawUserIDs, ok := leagueObj["userIds"].([]any); ok {
			var newIDs []any
			for _, rawID := range rawUserIDs {
				var uid int
				switch v := rawID.(type) {
				case float64:
					uid = int(v)
				case int:
					uid = v
				case string:
					uid, _ = strconv.Atoi(v)
				}
				if userPointsMap[uid] > 0 {
					newIDs = append(newIDs, uid)
				} else {
					updated = true
				}
			}
			leagueObj["userIds"] = newIDs
		}

		if rawUsers, ok := leagueObj["users"].([]any); ok {
			var newUsers []any
			for _, rawU := range rawUsers {
				if uMap, ok := rawU.(map[string]any); ok {
					var uid int
					if idVal, ok := uMap["userId"]; ok {
						switch v := idVal.(type) {
						case float64:
							uid = int(v)
						case int:
							uid = v
						case string:
							uid, _ = strconv.Atoi(v)
						}
					}
					if userPointsMap[uid] > 0 {
						uMap["points"] = 0
						newUsers = append(newUsers, uMap)
					} else {
						updated = true
					}
				}
			}
			leagueObj["users"] = newUsers
		}

		if updated {
			if b, err := json.MarshalIndent(leagueObj, "", "  "); err == nil {
				_ = os.WriteFile(leagueFilePath, b, 0644)
			}
		}
	}

	return nil
}

func (s *PredictballAPIService) pruneUserLeaguesMap(userPointsMap map[int]int, compID string) error {
	s.initUserLeagues()
	compIDInt, _ := strconv.Atoi(compID)

	for uidStr, comps := range userLeagues {
		uidInt, _ := strconv.Atoi(uidStr)
		if userPointsMap[uidInt] == 0 {
			var newComps []models.UserCompetitionLeagues
			for _, c := range comps {
				if c.CompetitionID != compIDInt {
					newComps = append(newComps, c)
				}
			}
			userLeagues[uidStr] = newComps
		}
	}

	var ulData []models.UserLeagues
	for uidStr, c := range userLeagues {
		uidInt, _ := strconv.Atoi(uidStr)
		ulData = append(ulData, models.UserLeagues{
			UserID:       uidInt,
			Competitions: c,
		})
	}

	bUL, err := json.MarshalIndent(ulData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode userLeagues data: %w", err)
	}

	return os.WriteFile("data/userLeagues.json", bUL, 0644)
}

func (s *PredictballAPIService) purgeUserPredictionsAndPowerups(compID string) error {
	usersDir := filepath.Join("data", "users")
	userDirs, err := os.ReadDir(usersDir)
	if err != nil {
		return nil
	}

	for _, uDir := range userDirs {
		if !uDir.IsDir() {
			continue
		}
		userCompDir := filepath.Join(usersDir, uDir.Name(), "competition", compID)
		_ = os.Remove(filepath.Join(userCompDir, "predictions.json"))
		_ = os.Remove(filepath.Join(userCompDir, "powerups.json"))
	}

	return nil
}

func (s *PredictballAPIService) purgeMatchCache(schedule []models.Match) {
	matchCacheDir := filepath.Join("cache", "matches")
	for _, m := range schedule {
		mIDStr := strconv.Itoa(m.ID)
		if patternFiles, err := filepath.Glob(filepath.Join(matchCacheDir, fmt.Sprintf("matches/%s_*.json", mIDStr))); err == nil {
			for _, pf := range patternFiles {
				_ = os.Remove(pf)
			}
		}
	}
	if entries, err := os.ReadDir(matchCacheDir); err == nil {
		for _, entry := range entries {
			for _, m := range schedule {
				if entry.Name() == strconv.Itoa(m.ID) {
					_ = os.RemoveAll(filepath.Join(matchCacheDir, entry.Name()))
				}
			}
		}
	}
}
