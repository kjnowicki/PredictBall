package services

import (
	"context"
	footballdata "predictball_api/models/football-data"
)

func (s *PredictballAPIService) GetTeam(ctx context.Context, teamID int) (*footballdata.Team, error) {
	return s.FootballDataService.GetTeamDetails(ctx, teamID, map[string]string{})
}
