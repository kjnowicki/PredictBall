package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
	"strconv"
	"time"
)

func getPredictionsPath(userID, compID string) string {
	safeUserID := sanitizeSegment(userID)
	safeCompID := sanitizeSegment(compID)
	return filepath.Join("data", "users", safeUserID, "competition", safeCompID, "predictions.json")
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
	resolvedCompID, err := s.ResolveCompetitionID(ctx, compID)
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	predMap, err := loadPredictions(userID, resolvedCompID)
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
	resolvedCompID, err := s.ResolveCompetitionID(ctx, compID)
	if err != nil {
		return nil, err
	}

	schedule, err := s.GetMatchSchedule(ctx, resolvedCompID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch schedule to validate prediction: %v", err)
	}

	matchFound := false
	validStatus := false
	for _, m := range schedule {
		if m.ID == prediction.MatchID {
			matchFound = true
			if (string(m.Status) == "SCHEDULED" || string(m.Status) == "TIMED" || string(m.Status) == "LINEUPS-READY") && m.StartTime.After(time.Now()) {
				validStatus = true
			}
			break
		}
	}

	if !matchFound {
		return nil, fmt.Errorf("match not found in schedule")
	}

	if !validStatus {
		return nil, fmt.Errorf("predictions are locked for matches that have already started")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	predMap, err := loadPredictions(userID, resolvedCompID)
	if err != nil {
		return nil, fmt.Errorf("failed to load predictions: %v", err)
	}

	if existing, ok := predMap[prediction.MatchID]; ok {
		prediction.ID = existing.ID
	} else {
		prediction.ID = len(predMap) + 1
	}

	predMap[prediction.MatchID] = prediction

	if err := savePredictions(userID, resolvedCompID, predMap); err != nil {
		return nil, fmt.Errorf("failed to save predictions: %v", err)
	}

	return &prediction, nil
}

func getPowerupsPath(userID, compID string) string {
	safeUserID := sanitizeSegment(userID)
	safeCompID := sanitizeSegment(compID)
	return filepath.Join("data", "users", safeUserID, "competition", safeCompID, "powerups.json")
}

func (s *PredictballAPIService) GetPowerups(ctx context.Context, userID string, compID string) (*models.PowerupsData, error) {
	resolvedCompID, err := s.ResolveCompetitionID(ctx, compID)
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	path := getPowerupsPath(userID, resolvedCompID)
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
	resolvedCompID, err := s.ResolveCompetitionID(ctx, compID)
	if err != nil {
		return nil, err
	}

	schedule, err := s.GetMatchSchedule(ctx, resolvedCompID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch schedule to validate powerups: %v", err)
	}

	// Group schedule matches by matchday/stage key to get match counts and N
	matchdayCounts := make(map[string]int)
	for _, m := range schedule {
		key := getMatchdayKey(m)
		if key != "" {
			matchdayCounts[key]++
		}
	}

	N := 0
	for _, count := range matchdayCounts {
		if count > N {
			N = count
		}
	}

	// Create a map of match ID to matchday key
	matchToKey := make(map[int]string)
	for _, m := range schedule {
		matchToKey[m.ID] = getMatchdayKey(m)
	}

	for i, md := range data.Matchdays {
		key := ""
		if strKey, ok := md.MatchdayNumber.(string); ok {
			key = strKey
		} else if floatKey, ok := md.MatchdayNumber.(float64); ok {
			key = strconv.Itoa(int(floatKey))
		} else if intKey, ok := md.MatchdayNumber.(int); ok {
			key = strconv.Itoa(intKey)
		}

		numMatches := matchdayCounts[key]
		mult := getMatchdayMultiplier(numMatches, N)

		// 1) Triple Score power up only allowed when there's no global multiplier (mult == 1)
		if mult > 1 && md.TripleScoreMatchId != 0 {
			md.TripleScoreMatchId = 0
		}

		// 2) Reversal powerup not allowed when there are only two matches or less
		if numMatches <= 2 && md.ReversalMatchId != 0 {
			md.ReversalMatchId = 0
		}

		// 3) Match stage/matchday mismatch check (self-healing)
		if md.DoubleScorerMatchId != 0 {
			matchKey, exists := matchToKey[md.DoubleScorerMatchId]
			if !exists || matchKey != key {
				md.DoubleScorerMatchId = 0
				md.DoubleScorerId = 0
			}
		}
		if md.TripleScoreMatchId != 0 {
			matchKey, exists := matchToKey[md.TripleScoreMatchId]
			if !exists || matchKey != key {
				md.TripleScoreMatchId = 0
			}
		}
		if md.ReversalMatchId != 0 {
			matchKey, exists := matchToKey[md.ReversalMatchId]
			if !exists || matchKey != key {
				md.ReversalMatchId = 0
			}
		}

		data.Matchdays[i] = md
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	path := getPowerupsPath(userID, resolvedCompID)
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
