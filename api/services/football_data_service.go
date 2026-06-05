package services

import (
	"context"
	"net/url"
	footballdata "predictball_api/models/football-data"
	"strings"
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

func (s *FootballDataService) GetMatches(ctx context.Context, seasons []string) (*MatchesResponse, error) {
	queryParams := url.Values{}
	if len(seasons) > 0 {
		queryParams.Set("seasons", strings.Join(seasons, ","))
	}

	var apiData MatchesResponse
	if err := s.apiClient.fetchAPI(ctx, "matches", queryParams, &apiData); err != nil {
		return nil, err
	}
	return &apiData, nil
}
