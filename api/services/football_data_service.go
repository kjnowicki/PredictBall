package services

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/url"
	"os"
	footballdata "predictball_api/models/football-data"
	"time"
)

type FootballDataService struct {
	apiClient *PredictballAPIService
}

type MatchesResponse struct {
	Filters     any                      `json:"filters"`
	ResultSet   any                      `json:"resultSet"`
	Competition footballdata.Competition `json:"competition"`
	Matches     []footballdata.Match     `json:"matches"`
}

type CompetitionsResponse struct {
	Count        int                        `json:"count"`
	Competitions []footballdata.Competition `json:"competitions"`
}

func (s *FootballDataService) fetchCached(ctx context.Context, endpoint string, params map[string]string, target any) error {
	queryParams := url.Values{}
	for k, v := range params {
		queryParams.Set(k, v)
	}
	h := fnv.New32a()
	h.Write([]byte(queryParams.Encode()))
	cacheBaseName := fmt.Sprintf("football_data_%s_%x", endpoint, h.Sum32())

	if readCache(s.apiClient, cacheBaseName, target) {
		return nil
	}

	if err := s.apiClient.fetchAPI(ctx, endpoint, queryParams, target); err != nil {
		return err
	}

	writeCache(s.apiClient, cacheBaseName, target, 30*time.Minute)

	return nil
}

func (s *FootballDataService) GetMatches(ctx context.Context, params map[string]string) (*MatchesResponse, error) {
	var apiData MatchesResponse
	if err := s.fetchCached(ctx, "matches", params, &apiData); err != nil {
		return nil, err
	}
	return &apiData, nil
}

func (s *FootballDataService) GetCompetitions(ctx context.Context, params map[string]string) (*CompetitionsResponse, error) {
	var apiData CompetitionsResponse
	if err := s.fetchCached(ctx, "competitions", params, &apiData); err != nil {
		return nil, err
	}

	var filtered []footballdata.Competition
	for _, comp := range apiData.Competitions {
		dirPath := fmt.Sprintf("data/competitions/%d", comp.ID)
		if info, err := os.Stat(dirPath); err == nil && info.IsDir() {
			filtered = append(filtered, comp)
		}
	}
	apiData.Competitions = filtered
	apiData.Count = len(filtered)

	return &apiData, nil
}

func (s *FootballDataService) GetTeamDetails(ctx context.Context, teamID int, params map[string]string) (*footballdata.Team, error) {
	var apiData footballdata.Team
	if err := s.fetchCached(ctx, fmt.Sprintf("teams/%d", teamID), params, &apiData); err != nil {
		return nil, err
	}
	return &apiData, nil
}
