package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"strconv"
	"strings"
)

func getArchivedSeasonIDs(compID string) map[string]bool {
	archived := make(map[string]bool)
	archiveDir := filepath.Join("data", "competitions", compID, "leagues", "archive")
	files, err := os.ReadDir(archiveDir)
	if err != nil {
		return archived
	}
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), "0_") && strings.HasSuffix(f.Name(), ".json") {
			seasonStr := strings.TrimPrefix(f.Name(), "0_")
			seasonStr = strings.TrimSuffix(seasonStr, ".json")
			archived[seasonStr] = true
		}
	}
	return archived
}

func (s *PredictballAPIService) GetCompetitions(ctx context.Context) ([]footballdata.Competition, error) {
	apiData, err := s.FootballDataService.GetCompetitions(ctx, map[string]string{"plan": "TIER_ONE"})
	if err != nil {
		return nil, err
	}
	return apiData.Competitions, nil
}

func (s *PredictballAPIService) GetCompetition(ctx context.Context, code string) (*footballdata.Competition, error) {
	comps, err := s.GetCompetitions(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range comps {
		if c.Code == code || fmt.Sprint(c.ID) == code {
			return &c, nil
		}
	}
	return nil, fmt.Errorf("competition not found")
}

func (s *PredictballAPIService) ResolveCompetitionID(ctx context.Context, code string) (string, error) {
	if _, err := strconv.Atoi(code); err == nil {
		return code, nil
	}
	comp, err := s.GetCompetition(ctx, code)
	if err != nil {
		return "", err
	}
	return fmt.Sprint(comp.ID), nil
}

func (s *PredictballAPIService) GetAllAvailableCompetitions(ctx context.Context) ([]footballdata.Competition, error) {
	apiData, err := s.FootballDataService.GetAllAvailableCompetitions(ctx)
	if err != nil {
		return nil, err
	}
	return apiData.Competitions, nil
}

func (s *PredictballAPIService) GetCompetitionDetail(ctx context.Context, compCode string) (*footballdata.Competition, error) {
	comp, err := s.FootballDataService.GetCompetitionDetail(ctx, compCode)
	if err != nil {
		return nil, err
	}

	compIDStr, _ := s.ResolveCompetitionID(ctx, compCode)
	archivedSeasons := getArchivedSeasonIDs(compIDStr)

	var filtered []footballdata.Season
	for _, season := range comp.Seasons {
		sIDStr := fmt.Sprint(season.ID)
		yearStr := ""
		if len(season.StartDate) >= 4 {
			yearStr = season.StartDate[:4]
		}
		// Only include current season or seasons that exist in archived standings
		if (comp.CurrentSeason.ID != 0 && season.ID == comp.CurrentSeason.ID) || archivedSeasons[sIDStr] || (yearStr != "" && archivedSeasons[yearStr]) {
			filtered = append(filtered, season)
		}
	}
	if len(filtered) == 0 && comp.CurrentSeason.ID != 0 {
		filtered = append(filtered, comp.CurrentSeason)
	}
	comp.Seasons = filtered
	return comp, nil
}

func (s *PredictballAPIService) AddCompetition(ctx context.Context, compID string) (*footballdata.Competition, error) {
	comp, err := s.GetCompetitionDetail(ctx, compID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch competition detail for %s: %w", compID, err)
	}

	compIDStr := fmt.Sprint(comp.ID)
	leaguesDir := filepath.Join("data", "competitions", compIDStr, "leagues")
	if err := os.MkdirAll(leaguesDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory structure for competition %s: %w", compIDStr, err)
	}

	globalLeagueFile := filepath.Join(leaguesDir, "0.json")
	if _, err := os.Stat(globalLeagueFile); os.IsNotExist(err) {
		globalLeague := models.GlobalLeague{
			PredictionLeague: models.PredictionLeague{
				ID:       0,
				Name:     "Global League",
				JoinCode: "",
				Public:   true,
			},
			Users: []models.LeagueUser{},
		}
		data, err := json.MarshalIndent(globalLeague, "", "  ")
		if err == nil {
			_ = os.WriteFile(globalLeagueFile, data, 0644)
		}
	}

	// Trigger initial match schedule fetch to initialize competition matches cache
	_, _ = s.GetMatchSchedule(ctx, compIDStr)

	return comp, nil
}

