package services

import (
	"context"
	footballdata "predictball_api/models/football-data"
)

func (s *PredictballAPIService) GetCompetitions(ctx context.Context) ([]footballdata.Competition, error) {
	apiData, err := s.FootballDataService.GetCompetitions(ctx, map[string]string{"plan": "TIER_ONE"})
	if err != nil {
		return nil, err
	}
	return apiData.Competitions, nil
}
