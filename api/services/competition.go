package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"strconv"
	"strings"
	"time"
)

func getArchivedSeasonIDs(compID string) map[string]bool {
	archived := make(map[string]bool)
	archiveDir := filepath.Join("data", "competitions", compID, "leagues", "archive")
	files, err := os.ReadDir(archiveDir)
	if err != nil {
		return archived
	}
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), "0_") && strings.HasSuffix(f.Name(), ".json") {
			seasonStr := strings.TrimPrefix(f.Name(), "0_")
			seasonStr = strings.TrimSuffix(seasonStr, ".json")
			archived[seasonStr] = true
		}
	}
	return archived
}

func enrichSeason(season *footballdata.Season, archivedSeasons map[string]bool) {
	if season == nil || season.ID == 0 {
		return
	}

	sIDStr := fmt.Sprint(season.ID)
	yearStr := ""
	if len(season.StartDate) >= 4 {
		yearStr = season.StartDate[:4]
	}

	season.IsRetired = archivedSeasons[sIDStr] || (yearStr != "" && archivedSeasons[yearStr])

	if season.IsRetired {
		season.IsFinished = true
		return
	}

	if season.EndDate != "" {
		if t, err := time.Parse("2006-01-02", season.EndDate); err == nil {
			endOfDay := t.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			if time.Now().After(endOfDay) {
				season.IsFinished = true
			}
		} else if t, err := time.Parse(time.RFC3339, season.EndDate); err == nil {
			if time.Now().After(t) {
				season.IsFinished = true
			}
		}
	}
}

func (s *PredictballAPIService) GetCompetitions(ctx context.Context) ([]footballdata.Competition, error) {
	apiData, err := s.FootballDataService.GetCompetitions(ctx, map[string]string{"plan": "TIER_ONE"})
	if err != nil {
		return nil, err
	}
	for i := range apiData.Competitions {
		compIDStr := fmt.Sprint(apiData.Competitions[i].ID)
		archivedSeasons := getArchivedSeasonIDs(compIDStr)
		enrichSeason(&apiData.Competitions[i].CurrentSeason, archivedSeasons)
		for j := range apiData.Competitions[i].Seasons {
			enrichSeason(&apiData.Competitions[i].Seasons[j], archivedSeasons)
		}
	}
	return apiData.Competitions, nil
}

func (s *PredictballAPIService) GetCompetition(ctx context.Context, code string) (*footballdata.Competition, error) {
	comps, err := s.GetCompetitions(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range comps {
		if c.Code == code || fmt.Sprint(c.ID) == code {
			return &c, nil
		}
	}
	return nil, fmt.Errorf("competition not found")
}

func (s *PredictballAPIService) ResolveCompetitionID(ctx context.Context, code string) (string, error) {
	if _, err := strconv.Atoi(code); err == nil {
		return code, nil
	}
	comp, err := s.GetCompetition(ctx, code)
	if err != nil {
		return "", err
	}
	return fmt.Sprint(comp.ID), nil
}

func (s *PredictballAPIService) GetAllAvailableCompetitions(ctx context.Context) ([]footballdata.Competition, error) {
	apiData, err := s.FootballDataService.GetAllAvailableCompetitions(ctx)
	if err != nil {
		return nil, err
	}
	return apiData.Competitions, nil
}

func (s *PredictballAPIService) GetCompetitionDetail(ctx context.Context, compCode string) (*footballdata.Competition, error) {
	comp, err := s.FootballDataService.GetCompetitionDetail(ctx, compCode)
	if err != nil {
		return nil, err
	}

	compIDStr, _ := s.ResolveCompetitionID(ctx, compCode)
	archivedSeasons := getArchivedSeasonIDs(compIDStr)

	enrichSeason(&comp.CurrentSeason, archivedSeasons)

	var filtered []footballdata.Season
	for _, season := range comp.Seasons {
		sIDStr := fmt.Sprint(season.ID)
		yearStr := ""
		if len(season.StartDate) >= 4 {
			yearStr = season.StartDate[:4]
		}
		enrichSeason(&season, archivedSeasons)
		// Only include current season or seasons that exist in archived standings
		if (comp.CurrentSeason.ID != 0 && season.ID == comp.CurrentSeason.ID) || archivedSeasons[sIDStr] || (yearStr != "" && archivedSeasons[yearStr]) {
			filtered = append(filtered, season)
		}
	}
	if len(filtered) == 0 && comp.CurrentSeason.ID != 0 {
		filtered = append(filtered, comp.CurrentSeason)
	}
	comp.Seasons = filtered
	return comp, nil
}

func (s *PredictballAPIService) AddCompetition(ctx context.Context, compID string) (*footballdata.Competition, error) {
	comp, err := s.GetCompetitionDetail(ctx, compID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch competition detail for %s: %w", compID, err)
	}

	compIDStr := fmt.Sprint(comp.ID)
	leaguesDir := filepath.Join("data", "competitions", compIDStr, "leagues")
	if err := os.MkdirAll(leaguesDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory structure for competition %s: %w", compIDStr, err)
	}

	globalLeagueFile := filepath.Join(leaguesDir, "0.json")
	if _, err := os.Stat(globalLeagueFile); os.IsNotExist(err) {
		globalLeague := models.GlobalLeague{
			PredictionLeague: models.PredictionLeague{
				ID:       0,
				Name:     "Global League",
				JoinCode: "",
				Public:   true,
			},
			Users: []models.LeagueUser{},
		}
		data, err := json.MarshalIndent(globalLeague, "", "  ")
		if err == nil {
			_ = os.WriteFile(globalLeagueFile, data, 0644)
		}
	}

	_ = s.InitGlobalCasualLeague(ctx, compIDStr)

	// Trigger initial match schedule fetch to initialize competition matches cache
	_, _ = s.GetMatchSchedule(ctx, compIDStr)

	return comp, nil
}

func (s *PredictballAPIService) InitGlobalCasualLeague(ctx context.Context, competitionID string) error {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	leaguesDir := filepath.Join("data", "competitions", compID, "leagues")
	os.MkdirAll(leaguesDir, 0755)

	globalLeagueFile := filepath.Join(leaguesDir, "0.json")
	var globalUsers []models.LeagueUser
	if gData, err := os.ReadFile(globalLeagueFile); err == nil {
		var gLeague models.GlobalLeague
		if err := json.Unmarshal(gData, &gLeague); err == nil {
			globalUsers = gLeague.Users
		}
	}

	casualLeagueFile := filepath.Join(leaguesDir, "C.json")
	var casualLeague models.GlobalLeague

	if cData, err := os.ReadFile(casualLeagueFile); err == nil {
		json.Unmarshal(cData, &casualLeague)
	}

	casualLeague.PredictionLeague = models.PredictionLeague{
		ID:       0,
		Name:     "Global Casual League",
		JoinCode: "",
		Public:   true,
		IsCasual: true,
	}

	userMap := make(map[int]models.LeagueUser)
	for _, u := range casualLeague.Users {
		userMap[u.UserID] = u
	}

	for _, u := range globalUsers {
		if _, exists := userMap[u.UserID]; !exists {
			userMap[u.UserID] = models.LeagueUser{
				UserID: u.UserID,
				Name:   u.Name,
				Points: 0,
			}
		} else {
			existing := userMap[u.UserID]
			if u.Name != "" && existing.Name != u.Name {
				existing.Name = u.Name
				userMap[u.UserID] = existing
			}
		}
	}

	var newCasualUsers []models.LeagueUser
	for _, u := range globalUsers {
		if cu, ok := userMap[u.UserID]; ok {
			newCasualUsers = append(newCasualUsers, cu)
		}
	}
	// Also retain any casual-only users
	for uid, cu := range userMap {
		found := false
		for _, gu := range globalUsers {
			if gu.UserID == uid {
				found = true
				break
			}
		}
		if !found {
			newCasualUsers = append(newCasualUsers, cu)
		}
	}

	casualLeague.Users = newCasualUsers

	data, err := json.MarshalIndent(casualLeague, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode global casual league: %w", err)
	}

	return os.WriteFile(casualLeagueFile, data, 0644)
}

func (s *PredictballAPIService) DeleteCompetition(ctx context.Context, compCodeOrID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	compIDStr, _ := s.ResolveCompetitionID(ctx, compCodeOrID)

	comp, err := s.GetCompetition(ctx, compCodeOrID)
	code := ""
	if err == nil && comp != nil {
		code = comp.Code
	}

	// 1. Delete data/competitions/{compIDStr} and code
	os.RemoveAll(filepath.Join("data", "competitions", compIDStr))
	if code != "" {
		os.RemoveAll(filepath.Join("data", "competitions", code))
	}

	// 2. Delete cache/competitions/{compIDStr} and code
	os.RemoveAll(filepath.Join("cache", "competitions", compIDStr))
	if code != "" {
		os.RemoveAll(filepath.Join("cache", "competitions", code))
	}

	// 3. Clear schedule cache matching compIDStr or code
	if files, err := os.ReadDir(filepath.Join("cache", "schedules")); err == nil {
		for _, f := range files {
			name := f.Name()
			if strings.HasPrefix(name, compIDStr+"_") || (code != "" && strings.HasPrefix(name, code+"_")) {
				os.Remove(filepath.Join("cache", "schedules", name))
			}
		}
	}

	// 4. Remove compIDStr from userLeagues.json
	s.ensureUserLeaguesLoaded()
	compIDInt, _ := strconv.Atoi(compIDStr)

	for uidStr, comps := range userLeagues {
		var newComps []models.UserCompetitionLeagues
		for _, c := range comps {
			if c.CompetitionID != compIDInt {
				newComps = append(newComps, c)
			}
		}
		userLeagues[uidStr] = newComps
	}

	var ulData []models.UserLeagues
	for uidStr, c := range userLeagues {
		uidInt, _ := strconv.Atoi(uidStr)
		ulData = append(ulData, models.UserLeagues{
			UserID:       uidInt,
			Competitions: c,
		})
	}
	if bUL, err := json.MarshalIndent(ulData, "", "  "); err == nil {
		os.WriteFile("data/userLeagues.json", bUL, 0644)
	}

	// 5. Remove competition folder from user data
	if userDirs, err := os.ReadDir(filepath.Join("data", "users")); err == nil {
		for _, uDir := range userDirs {
			if uDir.IsDir() {
				os.RemoveAll(filepath.Join("data", "users", uDir.Name(), "competition", compIDStr))
				if code != "" {
					os.RemoveAll(filepath.Join("data", "users", uDir.Name(), "competition", code))
				}
			}
		}
	}

	return nil
}

