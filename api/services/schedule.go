package services

import (
	"context"
	"fmt"
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

	cacheBaseName := filepath.Join("cache", "schedules", fmt.Sprint(comp.ID))
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
