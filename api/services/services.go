package services

import (
	"context"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
)

type APIService interface {
	GetMatchSchedule(ctx context.Context) ([]models.Match, error)
	GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error)

	GetUser(ctx context.Context, userID string) (*models.User, error)
	PutUser(ctx context.Context, user models.User) (*models.User, error)
	AuthenticateUser(ctx context.Context, req models.User) (*models.User, error)
	GetUserLeagues(ctx context.Context, userID string) (*models.UserLeagues, error)

	GetCompetitions(ctx context.Context) ([]footballdata.Competition, error)

	GetPredictionLeague(ctx context.Context, leagueID string) (*models.PredictionLeague, error)
	PutPredictionLeague(ctx context.Context, league models.PredictionLeague) (*models.PredictionLeague, error)
	JoinGlobalLeague(ctx context.Context, competitionID string, userID string) (*models.GlobalLeague, error)

	GetPrediction(ctx context.Context, predictionID string) (*models.Prediction, error)
	PutPrediction(ctx context.Context, prediction models.Prediction) (*models.Prediction, error)
	UpdatePrediction(ctx context.Context, predictionID string, prediction models.Prediction) (*models.Prediction, error)

	GetScoringSystem(ctx context.Context) (*models.ScoringSystem, error)
	GetTeam(ctx context.Context, teamID int) (*footballdata.Team, error)
}
