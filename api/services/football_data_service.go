package services

import (
	"context"
	"net/url"
	footballdata "predictball_api/models/football-data"
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

func (s *FootballDataService) GetMatches(ctx context.Context, params map[string]string) (*MatchesResponse, error) {
	queryParams := url.Values{}
	for k, v := range params {
		queryParams.Set(k, v)
	}

	var apiData MatchesResponse
	if err := s.apiClient.fetchAPI(ctx, "matches", queryParams, &apiData); err != nil {
		return nil, err
	}
	return &apiData, nil
}
