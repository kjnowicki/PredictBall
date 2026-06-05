package services

import (
	"context"
	"predictball_api/models"
	"time"
)

func (s *PredictballAPIService) GetMatchSchedule(ctx context.Context) ([]models.Match, error) {
	var schedule []models.Match
	if readCache(s, "schedule_cache", &schedule) {
		return schedule, nil
	}

	apiData, err := s.FootballDataService.GetMatches(ctx, map[string]string{"season": "2026"})
	if err != nil {
		return nil, err
	}

	for _, m := range apiData.Matches {
		var homeScore, awayScore int
		if m.Score.FullTime.Home != nil {
			homeScore = *m.Score.FullTime.Home
		}
		if m.Score.FullTime.Away != nil {
			awayScore = *m.Score.FullTime.Away
		}

		var scorers []models.Player
		for _, g := range m.Goals {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}

		var startTime time.Time
		if t, err := time.Parse(time.RFC3339, m.UtcDate); err == nil {
			startTime = t
		}

		schedule = append(schedule, models.Match{
			ID:         m.ID,
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

	writeCache(s, "schedule_cache", schedule, 30*time.Minute)

	return schedule, nil
}
