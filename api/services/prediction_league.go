package services

import (
	"context"
	"fmt"
	"predictball_api/models"
)

func (s *PredictballAPIService) GetPredictionLeague(ctx context.Context, leagueID string) (*models.PredictionLeague, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if league, exists := s.predictionLeagues[leagueID]; exists {
		return &league, nil
	}
	return nil, fmt.Errorf("prediction league not found")
}

func (s *PredictballAPIService) PutPredictionLeague(ctx context.Context, league models.PredictionLeague) (*models.PredictionLeague, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if league.ID == 0 {
		league.ID = len(s.predictionLeagues) + 1
	}

	s.predictionLeagues[fmt.Sprint(league.ID)] = league
	return &league, nil
}
