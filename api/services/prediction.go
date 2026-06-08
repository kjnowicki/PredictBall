package services

import (
	"context"
	"fmt"
	"predictball_api/models"
)

func (s *PredictballAPIService) GetPrediction(ctx context.Context, predictionID string) (*models.Prediction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if pred, exists := s.predictions[predictionID]; exists {
		return &pred, nil
	}
	return nil, fmt.Errorf("prediction not found")
}

func (s *PredictballAPIService) PutPrediction(ctx context.Context, prediction models.Prediction) (*models.Prediction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if prediction.ID == 0 {
		prediction.ID = len(s.predictions) + 1
	}

	s.predictions[fmt.Sprint(prediction.ID)] = prediction
	return &prediction, nil
}

func (s *PredictballAPIService) UpdatePrediction(ctx context.Context, predictionID string, prediction models.Prediction) (*models.Prediction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.predictions[predictionID]; !exists {
		return nil, fmt.Errorf("prediction not found")
	}

	s.predictions[predictionID] = prediction
	return &prediction, nil
}
