package services

import (
	"context"
	"predictball_api/models"
	"time"
)

// TemplateService provides mock/templated data for the API
type TemplateService struct{}

func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

func (s *TemplateService) GetMatchSchedule(ctx context.Context) ([]models.Match, error) {
	return []models.Match{
		{ID: "m1", HomeTeam: "Arsenal", AwayTeam: "Chelsea", StartTime: time.Now().Add(24 * time.Hour), Status: "SCHEDULED"},
		{ID: "m2", HomeTeam: "Liverpool", AwayTeam: "Man City", StartTime: time.Now().Add(48 * time.Hour), Status: "SCHEDULED"},
	}, nil
}

func (s *TemplateService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	return &models.MatchDetails{
		Match: models.Match{
			ID: matchID, HomeTeam: "Arsenal", AwayTeam: "Chelsea", StartTime: time.Now().Add(-2 * time.Hour), Status: "FINISHED",
		},
		HomeScore: 2,
		AwayScore: 1,
	}, nil
}

func (s *TemplateService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	return &models.User{ID: userID, Username: "football_fan", Email: "fan@example.com"}, nil
}

func (s *TemplateService) PutUser(ctx context.Context, user models.User) (*models.User, error) {
	if user.ID == "" {
		user.ID = "new_user_123"
	}
	return &user, nil
}

func (s *TemplateService) GetPredictionLeague(ctx context.Context, leagueID string) (*models.PredictionLeague, error) {
	return &models.PredictionLeague{ID: leagueID, Name: "Premier League Predictors", Description: "Weekly PL predictions"}, nil
}

func (s *TemplateService) PutPredictionLeague(ctx context.Context, league models.PredictionLeague) (*models.PredictionLeague, error) {
	if league.ID == "" {
		league.ID = "new_league_123"
	}
	return &league, nil
}

func (s *TemplateService) GetPrediction(ctx context.Context, predictionID string) (*models.Prediction, error) {
	return &models.Prediction{ID: predictionID, UserID: "u1", MatchID: "m1", HomeScore: 1, AwayScore: 0}, nil
}

func (s *TemplateService) PutPrediction(ctx context.Context, prediction models.Prediction) (*models.Prediction, error) {
	if prediction.ID == "" {
		prediction.ID = "new_pred_123"
	}
	return &prediction, nil
}

func (s *TemplateService) UpdatePrediction(ctx context.Context, predictionID string, prediction models.Prediction) (*models.Prediction, error) {
	prediction.ID = predictionID
	return &prediction, nil
}

func (s *TemplateService) GetScoringSystem(ctx context.Context) (*models.ScoringSystem, error) {
	return &models.ScoringSystem{ID: "sys1", ExactScorePoints: 3, ResultPoints: 1}, nil
}

func (s *TemplateService) GetTeamSquad(ctx context.Context, teamID string) (*models.TeamSquad, error) {
	return &models.TeamSquad{
		TeamID: teamID,
		Players: []models.Player{
			{ID: "p1", Name: "Bukayo Saka", Position: "Forward"},
			{ID: "p2", Name: "Martin Odegaard", Position: "Midfielder"},
		},
	}, nil
}
