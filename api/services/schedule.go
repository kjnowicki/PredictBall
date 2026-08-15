package services

import (
	"context"
	"fmt"
	"path/filepath"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"strings"
	"time"
)

func (s *PredictballAPIService) GetMatchSchedule(ctx context.Context, compCode string, season ...string) ([]models.Match, error) {
	seasonStr := ""
	if len(season) > 0 && season[0] != "" {
		seasonStr = season[0]
	}

	comp, err := s.GetCompetition(ctx, compCode)
	compCodeStr := compCode
	compIDStr := compCode
	if err == nil && comp != nil {
		compCodeStr = comp.Code
		compIDStr = fmt.Sprint(comp.ID)
		seasonStr = resolveSeasonString(comp, seasonStr)
	}

	if seasonStr == "" {
		seasonStr = "2026"
	}

	if strings.Contains(compIDStr, "..") || strings.Contains(compIDStr, "/") || strings.Contains(compIDStr, "\\") {
		compIDStr = filepath.Base(filepath.Clean(compIDStr))
	}
	if strings.Contains(compCodeStr, "..") || strings.Contains(compCodeStr, "/") || strings.Contains(compCodeStr, "\\") {
		compCodeStr = filepath.Base(filepath.Clean(compCodeStr))
	}
	if strings.Contains(seasonStr, "..") || strings.Contains(seasonStr, "/") || strings.Contains(seasonStr, "\\") {
		seasonStr = filepath.Base(filepath.Clean(seasonStr))
	}

	safeCompID := filepath.Base(filepath.Clean(compIDStr))
	safeCompCode := filepath.Base(filepath.Clean(compCodeStr))
	safeSeason := filepath.Base(filepath.Clean(seasonStr))

	cacheBaseName := filepath.Join("cache", "schedules", fmt.Sprintf("%s_%s", safeCompID, safeSeason))
	var existingSchedule []models.Match
	cacheExists := readCacheAny(s, cacheBaseName, &existingSchedule)
	if !cacheExists && compCodeStr != compIDStr {
		cacheBaseNameAlt := filepath.Join("cache", "schedules", fmt.Sprintf("%s_%s", safeCompCode, safeSeason))
		cacheExists = readCacheAny(s, cacheBaseNameAlt, &existingSchedule)
	}

	apiData, err := s.FootballDataService.GetMatches(ctx, compCodeStr, map[string]string{"season": seasonStr})
	if err != nil {
		if cacheExists {
			return existingSchedule, nil
		}
		return []models.Match{}, nil
	}

	existingMap := make(map[int]models.Match)
	if cacheExists {
		for _, m := range existingSchedule {
			existingMap[m.ID] = m
		}
	}

	var updatedSchedule []models.Match
	for _, m := range apiData.Matches {
		var startTime time.Time
		if t, err := time.Parse(time.RFC3339, m.UtcDate); err == nil {
			startTime = t
		}

		if existingMatch, exists := existingMap[m.ID]; exists {
			// Merge new schedule info while keeping previous match enrichment
			existingMatch.StartTime = startTime
			existingMatch.Status = models.MatchStatus(m.Status)
			existingMatch.Stage = m.Stage
			existingMatch.HomeTeamID = m.HomeTeam.ID
			existingMatch.AwayTeamID = m.AwayTeam.ID

			homeScore, awayScore := resolveRegularTimeScore(m.Score)
			liveHomeScore, liveAwayScore := resolveFullTimeScore(m.Score)
			existingMatch.HomeScore = homeScore
			existingMatch.AwayScore = awayScore
			existingMatch.LiveHomeScore = liveHomeScore
			existingMatch.LiveAwayScore = liveAwayScore
			existingMatch.Duration = m.Score.Duration

			if len(m.Goals) > 0 {
				existingMatch.Scorers = filterRegularTimeScorers(m.Goals)
			}

			updatedSchedule = append(updatedSchedule, existingMatch)
		} else {
			homeScore, awayScore := resolveRegularTimeScore(m.Score)
			liveHomeScore, liveAwayScore := resolveFullTimeScore(m.Score)
			scorers := filterRegularTimeScorers(m.Goals)

			updatedSchedule = append(updatedSchedule, models.Match{
				ID:         m.ID,
				Matchday:   m.Matchday,
				Stage:      m.Stage,
				HomeTeamID: m.HomeTeam.ID,
				AwayTeamID: m.AwayTeam.ID,
				StartTime:  startTime,
				Status:     models.MatchStatus(m.Status),
				MatchDetails: models.MatchDetails{
					HomeScore:     homeScore,
					AwayScore:     awayScore,
					LiveHomeScore: liveHomeScore,
					LiveAwayScore: liveAwayScore,
					Duration:      m.Score.Duration,
					Scorers:       scorers,
				},
			})
		}
	}

	// We specify 1 year TTL as this effectively acts as a persistent layer.
	// Missing API matches are safely pruned via the overwrite mapping above.
	writeCache(s, cacheBaseName, updatedSchedule, 24*time.Hour*365)

	return updatedSchedule, nil
}

func resolveSeasonString(comp *footballdata.Competition, seasonInput string) string {
	seasonInput = strings.TrimSpace(seasonInput)
	if comp == nil {
		return seasonInput
	}

	if seasonInput == "" {
		if len(comp.CurrentSeason.StartDate) >= 4 {
			return comp.CurrentSeason.StartDate[:4]
		}
		return seasonInput
	}

	if comp.CurrentSeason.ID != 0 && fmt.Sprint(comp.CurrentSeason.ID) == seasonInput {
		if len(comp.CurrentSeason.StartDate) >= 4 {
			return comp.CurrentSeason.StartDate[:4]
		}
	}

	for _, s := range comp.Seasons {
		if s.ID != 0 && fmt.Sprint(s.ID) == seasonInput {
			if len(s.StartDate) >= 4 {
				return s.StartDate[:4]
			}
		}
	}

	return seasonInput
}
