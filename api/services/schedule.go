package services

import (
	"context"
	"predictball_api/models"
	"sync"
	"time"
)

var matchScheduleCache sync.Map

type cachedScheduleData struct {
	Schedule []models.Match
	Expiry   time.Time
}

func (s *PredictballAPIService) GetMatchSchedule(ctx context.Context, compCode string) ([]models.Match, error) {
	now := time.Now().UTC()
	if cached, ok := matchScheduleCache.Load(compCode); ok {
		data := cached.(cachedScheduleData)
		if now.Before(data.Expiry) {
			return data.Schedule, nil
		}
	}

	comp, err := s.GetCompetition(ctx, compCode)
	if err != nil {
		return nil, err
	}

	apiData, err := s.FootballDataService.GetMatches(ctx, comp.Code, map[string]string{"season": "2026"})
	if err != nil {
		return nil, err
	}

	var schedule []models.Match
	for _, m := range apiData.Matches {
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

		var startTime time.Time
		if t, err := time.Parse(time.RFC3339, m.UtcDate); err == nil {
			startTime = t
		}

		schedule = append(schedule, models.Match{
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

	matchScheduleCache.Store(compCode, cachedScheduleData{
		Schedule: schedule,
		Expiry:   now.Add(10 * time.Minute),
	})

	return schedule, nil
}
