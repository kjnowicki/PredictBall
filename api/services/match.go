package services

import (
	"context"
	"fmt"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"sync"
	"time"
)

type cachedMatchData struct {
	Details *models.MatchDetails
	Expiry  time.Time
}

var matchDetailsCache sync.Map

func (s *PredictballAPIService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	now := time.Now().UTC()
	if cached, ok := matchDetailsCache.Load(matchID); ok {
		data := cached.(cachedMatchData)
		if now.Before(data.Expiry) {
			return data.Details, nil
		}
	}

	var apiMatch footballdata.Match
	if err := s.fetchCached(ctx, fmt.Sprintf("matches/%s", matchID), nil, &apiMatch, 2*time.Minute); err != nil {
		return nil, err
	}

	var homeScore, awayScore int
	if apiMatch.Score.FullTime.Home != nil {
		homeScore = *apiMatch.Score.FullTime.Home
	}
	if apiMatch.Score.FullTime.Away != nil {
		awayScore = *apiMatch.Score.FullTime.Away
	}

	scorers := make([]models.Player, 0)
	for _, g := range apiMatch.Goals {
		if g.Scorer.ID != 0 {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}
	}

	details := &models.MatchDetails{
		HomeScore: homeScore,
		AwayScore: awayScore,
		Scorers:   scorers,
	}

	var ttl time.Duration
	switch apiMatch.Status {
	case "SCHEDULED", "TIMED":
		matchTime, err := time.Parse(time.RFC3339, apiMatch.UtcDate)
		hasLineups := false // Replace with actual lineup check if available in footballdata.Match
		if err == nil && now.Add(1*time.Hour).Before(matchTime) && !hasLineups {
			ttl = time.Until(matchTime.Add(-1 * time.Hour))
		} else {
			ttl = 10 * time.Minute
		}
	case "IN_PLAY", "PAUSED":
		ttl = 10 * time.Minute
	case "FINISHED":
		ttl = 24 * time.Hour * 365
	default:
		ttl = 10 * time.Minute
	}

	matchDetailsCache.Store(matchID, cachedMatchData{
		Details: details,
		Expiry:  now.Add(ttl),
	})

	return details, nil
}

func (s *PredictballAPIService) GetMatch(ctx context.Context, compID string, matchID string) (*models.Match, error) {
	var apiMatch footballdata.Match
	if err := s.fetchCached(ctx, fmt.Sprintf("matches/%s", matchID), nil, &apiMatch, 1*time.Minute); err != nil {
		return nil, err
	}

	var homeScore, awayScore int
	if apiMatch.Score.FullTime.Home != nil {
		homeScore = *apiMatch.Score.FullTime.Home
	}
	if apiMatch.Score.FullTime.Away != nil {
		awayScore = *apiMatch.Score.FullTime.Away
	}

	scorers := make([]models.Player, 0)
	for _, g := range apiMatch.Goals {
		if g.Scorer.ID != 0 {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}
	}

	var startTime time.Time
	if t, err := time.Parse(time.RFC3339, apiMatch.UtcDate); err == nil {
		startTime = t
	}

	match := &models.Match{
		ID:         apiMatch.ID,
		Matchday:   apiMatch.Matchday,
		HomeTeamID: apiMatch.HomeTeam.ID,
		AwayTeamID: apiMatch.AwayTeam.ID,
		StartTime:  startTime,
		Status:     models.MatchStatus(apiMatch.Status),
		MatchDetails: models.MatchDetails{
			HomeScore: homeScore,
			AwayScore: awayScore,
			Scorers:   scorers,
		},
	}

	if cached, ok := matchScheduleCache.Load(compID); ok {
		data := cached.(cachedScheduleData)
		for i, m := range data.Schedule {
			if m.ID == match.ID {
				data.Schedule[i] = *match
				break
			}
		}
		matchScheduleCache.Store(compID, data)
	}

	return match, nil
}
