package services

import (
	"context"
	"fmt"
	footballdata "predictball_api/models/football-data"
	"strconv"
)

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

