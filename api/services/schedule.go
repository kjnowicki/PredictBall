package services

import (
	"context"
	"path/filepath"
	"predictball_api/models"
	"time"
)

func (s *PredictballAPIService) GetMatchSchedule(ctx context.Context, compCode string) ([]models.Match, error) {
	comp, err := s.GetCompetition(ctx, compCode)
	if err != nil {
		return nil, err
	}

	apiData, err := s.FootballDataService.GetMatches(ctx, comp.Code, map[string]string{"season": "2026"})
	if err != nil {
		return nil, err
	}

	cacheBaseName := filepath.Join("cache", "schedules", compCode)
	var existingSchedule []models.Match
	cacheExists := readCache(s, cacheBaseName, &existingSchedule)

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
			updatedSchedule = append(updatedSchedule, existingMatch)
		} else {
			var homeScore, awayScore int
			if m.Score.FullTime.Home != nil {
				homeScore = *m.Score.FullTime.Home
			}
			if m.Score.FullTime.Away != nil {
				awayScore = *m.Score.FullTime.Away
			}

			scorers := make([]models.Player, 0)
			for _, g := range m.Goals {
				if g.Scorer.ID != 0 {
					scorers = append(scorers, models.Player{
						ID:   g.Scorer.ID,
						Name: g.Scorer.Name,
					})
				}
			}

			updatedSchedule = append(updatedSchedule, models.Match{
				ID:         m.ID,
				Matchday:   m.Matchday,
				HomeTeamID: m.HomeTeam.ID,
				AwayTeamID: m.AwayTeam.ID,
				StartTime:  startTime,
				Status:     models.MatchStatus(m.Status),
				MatchDetails: models.MatchDetails{
					HomeScore: homeScore,
					AwayScore: awayScore,
					Scorers:   scorers,
				},
			})
		}
	}

	// We specify 1 year TTL as this effectively acts as a persistent layer.
	// Missing API matches are safely pruned via the overwrite mapping above.
	writeCache(s, cacheBaseName, updatedSchedule, 24*time.Hour*365)

	return updatedSchedule, nil
}
