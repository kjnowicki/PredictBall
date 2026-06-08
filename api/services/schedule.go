package services

import (
	"context"
	"fmt"
	"predictball_api/models"
	"strconv"
	"time"
)

func (s *PredictballAPIService) GetMatchSchedule(ctx context.Context, compIDStr string) ([]models.Match, error) {
	compID, err := strconv.Atoi(compIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid competition ID")
	}

	comp, err := s.GetCompetition(ctx, compID)
	if err != nil {
		return nil, err
	}

	var schedule []models.Match
	cacheKey := fmt.Sprintf("schedule_cache_%s", comp.Code)
	if readCache(s, cacheKey, &schedule) {
		return schedule, nil
	}

	apiData, err := s.FootballDataService.GetMatches(ctx, comp.Code, map[string]string{"season": "2026"})
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

	writeCache(s, cacheKey, schedule, 30*time.Minute)

	return schedule, nil
}
