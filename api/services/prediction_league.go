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

func (s *PredictballAPIService) GetPredictionLeague(ctx context.Context, competitionID string, leagueID string) (any, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	idInt, err := strconv.Atoi(leagueID)
	if err != nil {
		return nil, fmt.Errorf("invalid league id")
	}

	var filename string
	if idInt < 0 {
		filename = "0.json"
	} else {
		filename = fmt.Sprintf("%s.json", leagueID)
	}

	path := filepath.Join("data", "competitions", competitionID, "leagues", filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("prediction league not found: %v", err)
	}

	var league map[string]any
	if err := json.Unmarshal(data, &league); err != nil {
		return nil, fmt.Errorf("failed to parse league data: %v", err)
	}
	return league, nil
}

func (s *PredictballAPIService) PutPredictionLeague(ctx context.Context, competitionID string, league models.PredictionLeague) (*models.PredictionLeague, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Join("data", "competitions", competitionID, "leagues")
	os.MkdirAll(dir, 0755)

	if league.ID == 0 {
		files, _ := os.ReadDir(dir)
		league.ID = len(files) + 1
	}

	filename := fmt.Sprintf("%d.json", league.ID)
	path := filepath.Join(dir, filename)

	b, _ := json.MarshalIndent(league, "", "  ")
	os.WriteFile(path, b, 0644)

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
	path := filepath.Join(dir, "0.json")

	var globalLeague models.GlobalLeague
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &globalLeague)
	} else {
		compIDInt, _ := strconv.Atoi(competitionID)
		globalLeague.PredictionLeague = models.PredictionLeague{
			ID:       0 * compIDInt,
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
