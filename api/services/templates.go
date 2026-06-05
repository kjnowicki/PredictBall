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
		{ID: 1, HomeTeamID: 10, AwayTeamID: 20, StartTime: time.Now().Add(24 * time.Hour), Status: models.StatusScheduled},
		{ID: 2, HomeTeamID: 30, AwayTeamID: 40, StartTime: time.Now().Add(48 * time.Hour), Status: models.StatusScheduled},
	}, nil
}

func (s *TemplateService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	return &models.MatchDetails{
		HomeScore: 2,
		AwayScore: 1,
		Scorers: []models.Player{
			{ID: 1, Name: "Bukayo Saka", Position: "Forward"},
		},
	}, nil
}

func (s *TemplateService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	return &models.User{ID: 1, Username: "football_fan", Password: "hashedpassword"}, nil
}

func (s *TemplateService) PutUser(ctx context.Context, user models.User) (*models.User, error) {
	if user.ID == 0 {
		user.ID = 123
	}
	return &user, nil
}

func (s *TemplateService) GetPredictionLeague(ctx context.Context, leagueID string) (*models.PredictionLeague, error) {
	return &models.PredictionLeague{ID: 1, Name: "Premier League Predictors", JoinCode: "PL2026"}, nil
}

func (s *TemplateService) PutPredictionLeague(ctx context.Context, league models.PredictionLeague) (*models.PredictionLeague, error) {
	if league.ID == 0 {
		league.ID = 123
	}
	return &league, nil
}

func (s *TemplateService) GetPrediction(ctx context.Context, predictionID string) (*models.Prediction, error) {
	return &models.Prediction{ID: 1, UserID: 1, MatchID: 1, HomeScore: 1, AwayScore: 0, ScorerID: 1}, nil
}

func (s *TemplateService) PutPrediction(ctx context.Context, prediction models.Prediction) (*models.Prediction, error) {
	if prediction.ID == 0 {
		prediction.ID = 123
	}
	return &prediction, nil
}

func (s *TemplateService) UpdatePrediction(ctx context.Context, predictionID string, prediction models.Prediction) (*models.Prediction, error) {
	if prediction.ID == 0 {
		prediction.ID = 1
	}
	return &prediction, nil
}

func (s *TemplateService) GetScoringSystem(ctx context.Context) (*models.ScoringSystem, error) {
	return &models.ScoringSystem{ScoreDif: 1, ScoreExact: 3, ScoreHomeExact: 1, ScoreAwayExact: 1, Scorer: 2}, nil
}

func (s *TemplateService) GetTeamSquad(ctx context.Context, teamID string) (*models.TeamSquad, error) {
	return &models.TeamSquad{
		TeamID: 1,
		Players: []models.Player{
			{ID: 1, Name: "Bukayo Saka", Position: "Forward"},
			{ID: 2, Name: "Martin Odegaard", Position: "Midfielder"},
		},
	}, nil
}
