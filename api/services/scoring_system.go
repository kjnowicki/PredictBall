package services

import (
	"context"
	"predictball_api/models"
)

func (s *PredictballAPIService) GetScoringSystem(ctx context.Context) (*models.ScoringSystem, error) {
	return &models.ScoringSystem{
		ScoreDif:       1,
		ScoreExact:     3,
		ScoreHomeExact: 1,
		ScoreAwayExact: 1,
		Scorer:         2,
	}, nil
}
