package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
)

func getPredictionsPath(userID, compID string) string {
	return filepath.Join("data", "users", userID, "competition", compID, "predictions.json")
}

func loadPredictions(userID, compID string) (map[int]models.Prediction, error) {
	path := getPredictionsPath(userID, compID)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return make(map[int]models.Prediction), nil
		}
		return nil, err
	}
	var preds []models.Prediction
	if err := json.Unmarshal(data, &preds); err != nil {
		return nil, err
	}
	predMap := make(map[int]models.Prediction)
	for _, p := range preds {
		predMap[p.MatchID] = p
	}
	return predMap, nil
}

func savePredictions(userID, compID string, predMap map[int]models.Prediction) error {
	path := getPredictionsPath(userID, compID)
	os.MkdirAll(filepath.Dir(path), 0755)

	preds := make([]models.Prediction, 0, len(predMap))
	for _, p := range predMap {
		preds = append(preds, p)
	}

	b, err := json.MarshalIndent(preds, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0644)
}

func (s *PredictballAPIService) GetPredictions(ctx context.Context, userID string, compID string, matchIDs []int) ([]models.Prediction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	predMap, err := loadPredictions(userID, compID)
	if err != nil {
		return nil, fmt.Errorf("failed to load predictions: %v", err)
	}

	var results []models.Prediction
	for _, matchID := range matchIDs {
		if p, ok := predMap[matchID]; ok {
			results = append(results, p)
		}
	}
	return results, nil
}

func (s *PredictballAPIService) PutPrediction(ctx context.Context, userID string, compID string, prediction models.Prediction) (*models.Prediction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	predMap, err := loadPredictions(userID, compID)
	if err != nil {
		return nil, fmt.Errorf("failed to load predictions: %v", err)
	}

	if existing, ok := predMap[prediction.MatchID]; ok {
		prediction.ID = existing.ID
	} else {
		prediction.ID = len(predMap) + 1
	}

	predMap[prediction.MatchID] = prediction

	if err := savePredictions(userID, compID, predMap); err != nil {
		return nil, fmt.Errorf("failed to save predictions: %v", err)
	}

	return &prediction, nil
}

func getPowerupsPath(userID, compID string) string {
	return filepath.Join("data", "users", userID, "competition", compID, "powerups.json")
}

func (s *PredictballAPIService) GetPowerups(ctx context.Context, userID string, compID string) (*models.PowerupsData, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	path := getPowerupsPath(userID, compID)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &models.PowerupsData{}, nil
		}
		return nil, err
	}
	var powerups models.PowerupsData
	if err := json.Unmarshal(data, &powerups); err != nil {
		return nil, err
	}
	return &powerups, nil
}

func (s *PredictballAPIService) PutPowerups(ctx context.Context, userID string, compID string, data models.PowerupsData) (*models.PowerupsData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := getPowerupsPath(userID, compID)
	os.MkdirAll(filepath.Dir(path), 0755)

	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, b, 0644); err != nil {
		return nil, err
	}
	return &data, nil
}
