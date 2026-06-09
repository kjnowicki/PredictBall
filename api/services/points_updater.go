package services

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"predictball_api/models"
	"strconv"
	"time"
)

func (s *PredictballAPIService) StartPointsUpdater(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Minute)
	go func() {
		for {
			select {
			case <-ticker.C:
				s.updateGlobalLeaguePoints(ctx)
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

func calculatePointsForPrediction(match models.Match, prediction models.Prediction, activePowerup string, doubleScorerID int, scoring *models.ScoringSystem) int {
	if match.Status != "FINISHED" {
		return 0
	}

	actualHome := match.MatchDetails.HomeScore
	actualAway := match.MatchDetails.AwayScore
	predHome := prediction.HomeScore
	predAway := prediction.AwayScore

	if activePowerup == "reversal" && actualHome != actualAway {
		actualDiff := actualHome - actualAway
		predDiff := predHome - predAway
		if (actualDiff > 0 && predDiff < 0) || (actualDiff < 0 && predDiff > 0) {
			predHome, predAway = predAway, predHome
		}
	}

	points := 0
	if actualHome == predHome && actualAway == predAway {
		points += scoring.ScoreExact
	} else {
		if actualHome == predHome {
			points += scoring.ScoreHomeExact
		}
		if actualAway == predAway {
			points += scoring.ScoreAwayExact
		}
		if actualHome-actualAway == predHome-predAway {
			points += scoring.ScoreDif
		}
	}

	actualScorers := make(map[int]bool)
	for _, s := range match.MatchDetails.Scorers {
		actualScorers[s.ID] = true
	}

	scorerPoints := 0
	if prediction.ScorerID != 0 && actualScorers[prediction.ScorerID] {
		scorerPoints += scoring.Scorer
	}
	if activePowerup == "doubleScorer" && doubleScorerID != 0 && actualScorers[doubleScorerID] {
		scorerPoints += scoring.Scorer
	}

	points += scorerPoints
	if activePowerup == "tripleScore" {
		points *= 3
	}

	return points
}

func (s *PredictballAPIService) updateGlobalLeaguePoints(ctx context.Context) {
	scoring, err := s.GetScoringSystem(ctx)
	if err != nil {
		log.Println("Error reading scoring system:", err)
		return
	}

	competitionsDir := "data/competitions"
	files, err := os.ReadDir(competitionsDir)
	if err != nil {
		return
	}

	for _, file := range files {
		if !file.IsDir() {
			continue
		}
		compID := file.Name()
		leaguePath := filepath.Join(competitionsDir, compID, "leagues", "0.json")

		s.mu.RLock()
		data, err := os.ReadFile(leaguePath)
		s.mu.RUnlock()
		if err != nil {
			continue
		}

		var globalLeague models.GlobalLeague
		if err := json.Unmarshal(data, &globalLeague); err != nil {
			continue
		}

		schedule, err := s.GetMatchSchedule(ctx, compID)
		if err != nil {
			continue
		}

		matches := make(map[int]models.Match)
		for _, m := range schedule {
			matches[m.ID] = m
		}

		updated := false
		for i, user := range globalLeague.Users {
			userIDStr := strconv.Itoa(user.UserID)

			s.mu.RLock()
			preds, err := loadPredictions(userIDStr, compID)
			powerupBytes, _ := os.ReadFile(getPowerupsPath(userIDStr, compID))
			s.mu.RUnlock()

			if err != nil {
				continue
			}

			var pData map[string]any
			json.Unmarshal(powerupBytes, &pData)

			powerupForMatch := make(map[int]string)
			doubleScorerForMatch := make(map[int]int)

			if matchdays, ok := pData["matchdays"].([]any); ok {
				for _, md := range matchdays {
					if mdMap, ok := md.(map[string]any); ok {
						if dsmID, ok := mdMap["doubleScorerMatchId"].(float64); ok && dsmID != 0 {
							powerupForMatch[int(dsmID)] = "doubleScorer"
							if dsID, ok := mdMap["doubleScorerId"].(float64); ok {
								doubleScorerForMatch[int(dsmID)] = int(dsID)
							}
						}
						if tsmID, ok := mdMap["tripleScoreMatchId"].(float64); ok && tsmID != 0 {
							powerupForMatch[int(tsmID)] = "tripleScore"
						}
						if rsmID, ok := mdMap["reversalMatchId"].(float64); ok && rsmID != 0 {
							powerupForMatch[int(rsmID)] = "reversal"
						}
					}
				}
			}

			totalPoints := 0
			for _, pred := range preds {
				if match, ok := matches[pred.MatchID]; ok {
					activePowerup := powerupForMatch[match.ID]
					doubleScorerID := doubleScorerForMatch[match.ID]
					totalPoints += calculatePointsForPrediction(match, pred, activePowerup, doubleScorerID, scoring)
				}
			}

			if globalLeague.Users[i].Points != totalPoints {
				globalLeague.Users[i].Points = totalPoints
				updated = true
			}
		}

		if updated {
			b, err := json.MarshalIndent(globalLeague, "", "  ")
			if err == nil {
				s.mu.Lock()
				os.WriteFile(leaguePath, b, 0644)
				s.mu.Unlock()
			}
		}
	}
}
