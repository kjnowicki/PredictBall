package services

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/url"
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
