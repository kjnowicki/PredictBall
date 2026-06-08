package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
	"slices"
	"strconv"
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

func (s *PredictballAPIService) JoinGlobalLeague(ctx context.Context, competitionID string, userID string) (*models.GlobalLeague, error) {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %v", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	dir := fmt.Sprintf("data/competitions/%s/leagues", competitionID)
	os.MkdirAll(dir, 0755)
	path := filepath.Join(dir, "global.json")

	var globalLeague models.GlobalLeague
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &globalLeague)
	} else {
		compIDInt, _ := strconv.Atoi(competitionID)
		globalLeague.PredictionLeague = models.PredictionLeague{
			ID:       -compIDInt,
			Name:     "Global League",
			Public:   true,
			JoinCode: "GLOBAL",
		}
	}

	uid, _ := strconv.Atoi(userID)
	for _, u := range globalLeague.Users {
		if u.UserID == uid {
			return &globalLeague, nil
		}
	}

	globalLeague.Users = append(globalLeague.Users, models.LeagueUser{
		UserID: uid,
		Name:   user.DisplayName,
		Points: 0,
	})

	b, _ := json.MarshalIndent(globalLeague, "", "  ")
	os.WriteFile(path, b, 0644)

	s.initUserLeagues()
	compIDInt, _ := strconv.Atoi(competitionID)
	comps := userLeagues[userID]
	foundComp := false
	for i, c := range comps {
		if c.CompetitionID == compIDInt {
			foundComp = true
			foundLeague := slices.Contains(c.LeagueIDs, globalLeague.ID)
			if !foundLeague {
				comps[i].LeagueIDs = append(comps[i].LeagueIDs, globalLeague.ID)
			}
			break
		}
	}
	if !foundComp {
		comps = append(comps, models.UserCompetitionLeagues{
			CompetitionID: compIDInt,
			LeagueIDs:     []int{globalLeague.ID},
		})
	}
	userLeagues[userID] = comps

	var ulData []models.UserLeagues
	for uidStr, c := range userLeagues {
		uidInt, _ := strconv.Atoi(uidStr)
		ulData = append(ulData, models.UserLeagues{
			UserID:       uidInt,
			Competitions: c,
		})
	}
	bUL, _ := json.MarshalIndent(ulData, "", "  ")
	os.WriteFile("data/userLeagues.json", bUL, 0644)

	return &globalLeague, nil
}
