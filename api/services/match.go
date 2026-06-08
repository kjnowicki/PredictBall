package services

import (
	"context"
	"fmt"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
)

func (s *PredictballAPIService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	var apiMatch footballdata.Match
	if err := s.fetchCached(ctx, fmt.Sprintf("matches/%s", matchID), nil, &apiMatch); err != nil {
		return nil, err
	}

	var homeScore, awayScore int
	if apiMatch.Score.FullTime.Home != nil {
		homeScore = *apiMatch.Score.FullTime.Home
	}
	if apiMatch.Score.FullTime.Away != nil {
		awayScore = *apiMatch.Score.FullTime.Away
	}

	var scorers []models.Player
	for _, g := range apiMatch.Goals {
		scorers = append(scorers, models.Player{
			ID:   g.Scorer.ID,
			Name: g.Scorer.Name,
		})
	}

	return &models.MatchDetails{
		HomeScore: homeScore,
		AwayScore: awayScore,
		Scorers:   scorers,
	}, nil
}
