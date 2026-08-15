package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"predictball_api/models"
	"sort"
	"strings"
	"time"
)

type CasualMatchesData struct {
	CasualMatchIDs []int            `json:"casualMatchIds"`
	ByMatchday     map[string][]int `json:"byMatchday"`
}

func (s *PredictballAPIService) GetCasualMatchIDs(ctx context.Context, competitionID string, season ...string) ([]int, map[string][]int, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, nil, err
	}

	seasonStr := ""
	if len(season) > 0 && season[0] != "" {
		seasonStr = season[0]
	}

	if strings.Contains(compID, "..") || strings.Contains(compID, "/") || strings.Contains(compID, "\\") {
		return nil, nil, fmt.Errorf("invalid competition id")
	}
	compID = filepath.Base(filepath.Clean(compID))

	if seasonStr == "" {
		if comp, err := s.GetCompetition(ctx, compID); err == nil && comp != nil {
			seasonStr = resolveSeasonString(comp, "")
		}
	}

	if seasonStr == "" {
		seasonStr = "2026"
	}

	if strings.Contains(seasonStr, "..") || strings.Contains(seasonStr, "/") || strings.Contains(seasonStr, "\\") {
		return nil, nil, fmt.Errorf("invalid season")
	}
	seasonStr = filepath.Base(filepath.Clean(seasonStr))

	path := filepath.Join("data", "competitions", compID, fmt.Sprintf("casual_matches_%s.json", seasonStr))
	fallbackPath := filepath.Join("data", "competitions", compID, "casual_matches.json")

	s.mu.RLock()
	data, err := os.ReadFile(path)
	if err != nil {
		data, err = os.ReadFile(fallbackPath)
	}
	s.mu.RUnlock()

	if err == nil {
		var cmd CasualMatchesData
		if err := json.Unmarshal(data, &cmd); err == nil && len(cmd.CasualMatchIDs) > 0 {
			if cmd.ByMatchday == nil {
				cmd.ByMatchday = make(map[string][]int)
			}
			return cmd.CasualMatchIDs, cmd.ByMatchday, nil
		}
	}

	return s.GenerateCasualMatches(ctx, compID, seasonStr)
}

func (s *PredictballAPIService) GenerateCasualMatches(ctx context.Context, competitionID string, season ...string) ([]int, map[string][]int, error) {
	compID, err := s.ResolveCompetitionID(ctx, competitionID)
	if err != nil {
		return nil, nil, err
	}

	seasonStr := ""
	if len(season) > 0 && season[0] != "" {
		seasonStr = season[0]
	}

	schedule, err := s.GetMatchSchedule(ctx, compID, seasonStr)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch schedule for casual match generation: %w", err)
	}

	if len(schedule) == 0 {
		return nil, nil, fmt.Errorf("empty match schedule")
	}

	if seasonStr == "" {
		if comp, err := s.GetCompetition(ctx, compID); err == nil && comp != nil {
			seasonStr = resolveSeasonString(comp, "")
		}
	}
	if seasonStr == "" {
		seasonStr = "2026"
	}

	type matchGroup struct {
		key       string
		startTime time.Time
		matches   []models.Match
	}

	groupMap := make(map[string]*matchGroup)
	for _, m := range schedule {
		if m.HomeTeamID == 0 || m.AwayTeamID == 0 {
			continue
		}
		key := getMatchdayKey(m)
		if key == "" {
			continue
		}
		if mg, exists := groupMap[key]; exists {
			mg.matches = append(mg.matches, m)
			if m.StartTime.Before(mg.startTime) {
				mg.startTime = m.StartTime
			}
		} else {
			groupMap[key] = &matchGroup{
				key:       key,
				startTime: m.StartTime,
				matches:   []models.Match{m},
			}
		}
	}

	var groups []*matchGroup
	for _, mg := range groupMap {
		groups = append(groups, mg)
	}

	sort.Slice(groups, func(i, j int) bool {
		return groups[i].startTime.Before(groups[j].startTime)
	})

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	teamSelectedCount := make(map[int]int)

	var selectedMatchIDs []int
	byMatchday := make(map[string][]int)

	for i, mg := range groups {
		if len(mg.matches) == 0 {
			continue
		}

		targetCount := 3
		if len(mg.matches) < targetCount {
			targetCount = len(mg.matches)
		}

		candidates := make([]models.Match, len(mg.matches))
		copy(candidates, mg.matches)

		for k := 0; k < targetCount; k++ {
			if len(candidates) == 0 {
				break
			}

			var chosenIndex int
			if i == 0 {
				// Matchday 1: fully random pick
				chosenIndex = r.Intn(len(candidates))
			} else {
				// Subsequent matchdays: weighted random pick favoring lower team frequencies
				weights := make([]float64, len(candidates))
				totalWeight := 0.0
				for idx, m := range candidates {
					homeCount := teamSelectedCount[m.HomeTeamID]
					awayCount := teamSelectedCount[m.AwayTeamID]
					w := 1.0 / (1.0 + float64(homeCount) + float64(awayCount))
					weights[idx] = w
					totalWeight += w
				}

				rndVal := r.Float64() * totalWeight
				accum := 0.0
				chosenIndex = len(candidates) - 1 // fallback
				for idx, w := range weights {
					accum += w
					if rndVal <= accum {
						chosenIndex = idx
						break
					}
				}
			}

			chosen := candidates[chosenIndex]
			teamSelectedCount[chosen.HomeTeamID]++
			teamSelectedCount[chosen.AwayTeamID]++

			selectedMatchIDs = append(selectedMatchIDs, chosen.ID)
			byMatchday[mg.key] = append(byMatchday[mg.key], chosen.ID)

			// Remove chosen candidate from candidates list for this matchday
			candidates = append(candidates[:chosenIndex], candidates[chosenIndex+1:]...)
		}
	}

	casualData := CasualMatchesData{
		CasualMatchIDs: selectedMatchIDs,
		ByMatchday:     byMatchday,
	}

	data, err := json.MarshalIndent(casualData, "", "  ")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to encode casual matches data: %w", err)
	}

	if strings.Contains(compID, "..") || strings.Contains(compID, "/") || strings.Contains(compID, "\\") {
		return nil, nil, fmt.Errorf("invalid competition id")
	}
	compID = filepath.Base(filepath.Clean(compID))

	if strings.Contains(seasonStr, "..") || strings.Contains(seasonStr, "/") || strings.Contains(seasonStr, "\\") {
		return nil, nil, fmt.Errorf("invalid season")
	}
	seasonStr = filepath.Base(filepath.Clean(seasonStr))

	dir := filepath.Join("data", "competitions", compID)
	os.MkdirAll(dir, 0755)
	seasonPath := filepath.Join(dir, fmt.Sprintf("casual_matches_%s.json", seasonStr))
	mainPath := filepath.Join(dir, "casual_matches.json")

	s.mu.Lock()
	_ = os.WriteFile(seasonPath, data, 0644)
	_ = os.WriteFile(mainPath, data, 0644)
	s.mu.Unlock()

	return selectedMatchIDs, byMatchday, nil
}
