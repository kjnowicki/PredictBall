package services

import (
	"context"
	"encoding/json"
	"os"
	"predictball_api/models"
)

func (s *PredictballAPIService) GetScoringSystem(ctx context.Context) (*models.ScoringSystem, error) {
	file, err := os.ReadFile("data/scoringSystem.json")
	if err != nil {
		return nil, err
	}
	var data map[string]int
	if err := json.Unmarshal(file, &data); err != nil {
		return nil, err
	}
	return &models.ScoringSystem{
		ScoreDif:       data["goalDif"],
		ScoreExact:     data["exactScore"],
		ScoreHomeExact: data["teamGoals"],
		ScoreAwayExact: data["teamGoals"],
		Scorer:         data["scorer"],
	}, nil
}
