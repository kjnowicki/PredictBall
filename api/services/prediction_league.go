package services

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"predictball_api/models"
	"slices"
	"sort"
	"strconv"
	"strings"
)

func (s *PredictballAPIService) GetPredictionLeague(ctx context.Context, competitionID string, leagueID string, season ...string) (any, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	var filename string
	if strings.EqualFold(leagueID, "C") {
		filename = "C.json"
		if len(season) > 0 && season[0] != "" {
			comp, _ := s.GetCompetition(ctx, competitionID)
			resolvedSeason := resolveSeasonString(comp, season[0])
			archivedPath := filepath.Join("data", "competitions", compID, "leagues", "archive", fmt.Sprintf("C_%s.json", resolvedSeason))
			if _, err := os.Stat(archivedPath); err == nil {
				filename = filepath.Join("archive", fmt.Sprintf("C_%s.json", resolvedSeason))
			}
		}
	} else {
		idInt, err := strconv.Atoi(leagueID)
		if err != nil {
			return nil, fmt.Errorf("invalid league id")
		}

		if idInt <= 0 {
			filename = "0.json"
			if len(season) > 0 && season[0] != "" {
				comp, _ := s.GetCompetition(ctx, competitionID)
				resolvedSeason := resolveSeasonString(comp, season[0])
				archivedPath := filepath.Join("data", "competitions", compID, "leagues", "archive", fmt.Sprintf("0_%s.json", resolvedSeason))
				if _, err := os.Stat(archivedPath); err == nil {
					filename = filepath.Join("archive", fmt.Sprintf("0_%s.json", resolvedSeason))
				}
			}
		} else {
			filename = fmt.Sprintf("%s.json", leagueID)
		}
	}

	path := filepath.Join("data", "competitions", compID, "leagues", filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("prediction league not found: %v", err)
	}

	var league map[string]any
	if err := json.Unmarshal(data, &league); err != nil {
		return nil, fmt.Errorf("failed to parse league data: %v", err)
	}

	s.ensureUsersLoaded()

	s.mu.RLock()
	defer s.mu.RUnlock()

	if usersList, ok := league["users"].([]any); ok {
		for _, uVal := range usersList {
			if userMap, ok := uVal.(map[string]any); ok {
				var uID string
				if idVal, ok := userMap["userId"]; ok {
					switch v := idVal.(type) {
					case float64:
						uID = strconv.Itoa(int(v))
					case string:
						uID = v
					case int:
						uID = strconv.Itoa(v)
					}
				}
				if uID != "" {
					if user, exists := s.users[uID]; exists {
						userMap["name"] = user.DisplayName
					}
				}
			}
		}
	}

	return league, nil
}

func generateJoinCode(length int) (string, error) {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	result := make([]byte, length)
	for i := range result {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		result[i] = chars[num.Int64()]
	}
	return string(result), nil
}

func (s *PredictballAPIService) PutPredictionLeague(ctx context.Context, competitionID string, userID string, league models.PredictionLeague) (*models.PredictionLeague, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	_, err = s.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found for league creation: %v", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Join("data", "competitions", compID, "leagues")
	os.MkdirAll(dir, 0755)

	if league.ID == 0 { // This is a new league
		files, _ := os.ReadDir(dir)
		maxID := 0
		for _, file := range files {
			if filepath.Ext(file.Name()) == ".json" {
				idStr := strings.TrimSuffix(file.Name(), ".json")
				id, err := strconv.Atoi(idStr)
				if err == nil && id > maxID {
					maxID = id
				}
			}
		}
		league.ID = maxID + 1

		joinCode, err := generateJoinCode(6)
		if err != nil {
			return nil, fmt.Errorf("failed to generate join code: %v", err)
		}
		league.JoinCode = joinCode
		league.Public = false

		uid, _ := strconv.Atoi(userID)
		league.UserIDs = []int{uid}

		s.initUserLeagues()
		compIDInt, _ := strconv.Atoi(compID)
		comps := userLeagues[userID]
		foundComp := false
		for i, c := range comps {
			if c.CompetitionID == compIDInt {
				foundComp = true
				if !slices.Contains(c.LeagueIDs, league.ID) {
					comps[i].LeagueIDs = append(comps[i].LeagueIDs, league.ID)
				}
				break
			}
		}
		if !foundComp {
			comps = append(comps, models.UserCompetitionLeagues{
				CompetitionID: compIDInt,
				LeagueIDs:     []int{league.ID},
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
	}

	filename := fmt.Sprintf("%d.json", league.ID)
	path := filepath.Join(dir, filename)

	b, _ := json.MarshalIndent(league, "", "  ")
	os.WriteFile(path, b, 0644)

	return &league, nil
}

func (s *PredictballAPIService) JoinGlobalLeague(ctx context.Context, competitionID string, userID string) (*models.GlobalLeague, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %v", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	dir := fmt.Sprintf("data/competitions/%s/leagues", compID)
	os.MkdirAll(dir, 0755)
	path := filepath.Join(dir, "0.json")

	var globalLeague models.GlobalLeague
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &globalLeague)
	} else {
		compIDInt, _ := strconv.Atoi(compID)
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

	// Also ensure user is in C.json
	casualPath := filepath.Join(dir, "C.json")
	var casualLeague models.GlobalLeague
	if cData, err := os.ReadFile(casualPath); err == nil {
		json.Unmarshal(cData, &casualLeague)
	} else {
		casualLeague.PredictionLeague = models.PredictionLeague{
			ID:       0,
			Name:     "Global Casual League",
			Public:   true,
			JoinCode: "CASUAL",
			IsCasual: true,
		}
	}

	foundInCasual := false
	for _, u := range casualLeague.Users {
		if u.UserID == uid {
			foundInCasual = true
			break
		}
	}
	if !foundInCasual {
		casualLeague.Users = append(casualLeague.Users, models.LeagueUser{
			UserID: uid,
			Name:   user.DisplayName,
			Points: 0,
		})
		cB, _ := json.MarshalIndent(casualLeague, "", "  ")
		os.WriteFile(casualPath, cB, 0644)
	}

	s.initUserLeagues()
	compIDInt, _ := strconv.Atoi(compID)
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

type LeagueDTO struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Public       bool   `json:"public"`
	Participants int    `json:"participants"`
	UserPlace    *int   `json:"userPlace,omitempty"`
}

type LeaguesResponse struct {
	PublicLeagues []LeagueDTO `json:"publicLeagues"`
	YourLeagues   []LeagueDTO `json:"yourLeagues"`
}

func (s *PredictballAPIService) GetCompetitionLeagues(ctx context.Context, competitionID string, userID string, season ...string) (any, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	dir := filepath.Join("data", "competitions", compID, "leagues")
	files, err := os.ReadDir(dir)

	resp := LeaguesResponse{
		PublicLeagues: []LeagueDTO{},
		YourLeagues:   []LeagueDTO{},
	}

	if err != nil {
		if os.IsNotExist(err) {
			return resp, nil
		}
		return nil, fmt.Errorf("failed to read leagues directory: %v", err)
	}

	uid, _ := strconv.Atoi(userID)

	// Determine global league file to read user points for requested season
	globalPath := filepath.Join(dir, "0.json")
	if len(season) > 0 && season[0] != "" {
		comp, _ := s.GetCompetition(ctx, competitionID)
		resolvedSeason := resolveSeasonString(comp, season[0])
		archivedPath := filepath.Join(dir, "archive", fmt.Sprintf("0_%s.json", resolvedSeason))
		if _, err := os.Stat(archivedPath); err == nil {
			globalPath = archivedPath
		}
	}

	globalPointsMap := make(map[int]int)
	if globalData, err := os.ReadFile(globalPath); err == nil {
		var globalLeague struct {
			Users []struct {
				UserID int `json:"userId"`
				Points int `json:"points"`
			} `json:"users"`
		}
		if err := json.Unmarshal(globalData, &globalLeague); err == nil {
			for _, u := range globalLeague.Users {
				globalPointsMap[u.UserID] = u.Points
			}
		}
	}

	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" {
			data, err := os.ReadFile(filepath.Join(dir, file.Name()))
			if err != nil {
				continue
			}
			var league struct {
				ID     int    `json:"id"`
				Name   string `json:"name"`
				Public bool   `json:"public"`
				Users  []struct {
					UserID int `json:"userId"`
					Points int `json:"points"`
				} `json:"users"`
				UserIDs []int `json:"userIds"`
			}
			if err := json.Unmarshal(data, &league); err == nil {
				isMember := false
				memberIDs := make(map[int]bool)

				for _, u := range league.Users {
					memberIDs[u.UserID] = true
					if u.UserID == uid {
						isMember = true
					}
				}
				for _, uID := range league.UserIDs {
					memberIDs[uID] = true
					if uID == uid {
						isMember = true
					}
				}

				participants := len(memberIDs)

				type memberScore struct {
					userID int
					points int
				}
				var members []memberScore
				for mID := range memberIDs {
					pts := globalPointsMap[mID]
					members = append(members, memberScore{userID: mID, points: pts})
				}

				sort.Slice(members, func(i, j int) bool {
					if members[i].points == members[j].points {
						return members[i].userID < members[j].userID
					}
					return members[i].points > members[j].points
				})

				var userPlace *int
				if isMember {
					for idx, m := range members {
						if m.userID == uid {
							rank := idx + 1
							userPlace = &rank
							break
						}
					}
				}

				dto := LeagueDTO{
					ID:           league.ID,
					Name:         league.Name,
					Public:       league.Public,
					Participants: participants,
					UserPlace:    userPlace,
				}

				if league.Public {
					resp.PublicLeagues = append(resp.PublicLeagues, dto)
				}
				if isMember {
					resp.YourLeagues = append(resp.YourLeagues, dto)
				}
			}
		}
	}

	return resp, nil
}

func (s *PredictballAPIService) JoinLeagueByCode(ctx context.Context, competitionID string, userID string, joinCode string) (any, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, err
	}

	_, err = s.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %v", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Join("data", "competitions", compID, "leagues")
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("competition leagues not found")
	}

	var foundLeague map[string]any
	var leagueFilePath string

	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" {
			path := filepath.Join(dir, file.Name())
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			var league map[string]any
			if err := json.Unmarshal(data, &league); err == nil {
				if code, ok := league["joinCode"].(string); ok && code == joinCode {
					foundLeague = league
					leagueFilePath = path
					break
				}
			}
		}
	}

	if foundLeague == nil {
		return nil, fmt.Errorf("league with join code not found")
	}

	uid, _ := strconv.Atoi(userID)

	userIdsInter, ok := foundLeague["userIds"].([]any)
	if !ok {
		userIdsInter = []any{}
	}

	isMember := false
	for _, uInter := range userIdsInter {
		if uID, ok := uInter.(float64); ok && int(uID) == uid {
			isMember = true
			break
		}
	}

	if !isMember {
		foundLeague["userIds"] = append(userIdsInter, uid)
		b, _ := json.MarshalIndent(foundLeague, "", "  ")
		os.WriteFile(leagueFilePath, b, 0644)

		s.initUserLeagues()
		compIDInt, _ := strconv.Atoi(compID)
		comps := userLeagues[userID]
		foundComp := false
		leagueIDFloat, _ := foundLeague["id"].(float64)
		leagueID := int(leagueIDFloat)

		for i, c := range comps {
			if c.CompetitionID == compIDInt {
				foundComp = true
				foundLeagueContains := slices.Contains(c.LeagueIDs, leagueID)
				if !foundLeagueContains {
					comps[i].LeagueIDs = append(comps[i].LeagueIDs, leagueID)
				}
				break
			}
		}
		if !foundComp {
			comps = append(comps, models.UserCompetitionLeagues{
				CompetitionID: compIDInt,
				LeagueIDs:     []int{leagueID},
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
	}

	return foundLeague, nil
}
