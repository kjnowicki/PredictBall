package services

import (
	"context"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"time"
)

type TemplateService struct{}

func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

func (s *TemplateService) GetMatchSchedule(ctx context.Context, compID string) ([]models.Match, error) {
	return []models.Match{
		{
			ID:         1,
			Matchday:   1,
			HomeTeamID: 10,
			AwayTeamID: 20,
			StartTime:  time.Now().Add(24 * time.Hour),
			Status:     models.StatusScheduled,
			MatchDetails: models.MatchDetails{
				HomeScore: 0,
				AwayScore: 0,
				HomeLineup: models.TeamSquad{
					TeamID: 10,
					Players: []models.Player{
						{ID: 1, Name: "Bukayo Saka", Position: "Forward"},
						{ID: 2, Name: "Declan Rice", Position: "Midfielder"},
					},
				},
				AwayLineup: models.TeamSquad{
					TeamID: 20,
					Players: []models.Player{
						{ID: 3, Name: "Phil Foden", Position: "Midfielder"},
						{ID: 4, Name: "Erling Haaland", Position: "Forward"},
					},
				},
				Scorers: []models.Player{},
			},
		},
		{
			ID:         2,
			Matchday:   1,
			HomeTeamID: 30,
			AwayTeamID: 40,
			StartTime:  time.Now().Add(48 * time.Hour),
			Status:     models.StatusScheduled,
			MatchDetails: models.MatchDetails{
				HomeScore: 0,
				AwayScore: 0,
				HomeLineup: models.TeamSquad{
					TeamID: 30,
					Players: []models.Player{
						{ID: 5, Name: "Mohamed Salah", Position: "Forward"},
					},
				},
				AwayLineup: models.TeamSquad{
					TeamID: 40,
					Players: []models.Player{
						{ID: 6, Name: "Son Heung-min", Position: "Forward"},
					},
				},
				Scorers: []models.Player{},
			},
		},
	}, nil
}

func (s *TemplateService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	return &models.MatchDetails{
		HomeScore: 2,
		AwayScore: 1,
		HomeLineup: models.TeamSquad{
			TeamID: 10,
			Players: []models.Player{
				{ID: 1, Name: "Bukayo Saka", Position: "Forward"},
				{ID: 2, Name: "Declan Rice", Position: "Midfielder"},
			},
		},
		AwayLineup: models.TeamSquad{
			TeamID: 20,
			Players: []models.Player{
				{ID: 3, Name: "Phil Foden", Position: "Midfielder"},
				{ID: 4, Name: "Erling Haaland", Position: "Forward"},
			},
		},
		Scorers: []models.Player{
			{ID: 1, Name: "Bukayo Saka", Position: "Forward"},
			{ID: 3, Name: "Phil Foden", Position: "Midfielder"},
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

func (s *TemplateService) AuthenticateUser(ctx context.Context, req models.User) (*models.User, error) {
	return &req, nil
}

func (s *TemplateService) GetUserLeagues(ctx context.Context, userID string) (*models.UserLeagues, error) {
	return &models.UserLeagues{
		UserID: 1,
		Competitions: []models.UserCompetitionLeagues{
			{CompetitionID: 1, LeagueIDs: []int{1}},
		},
	}, nil
}

func (s *TemplateService) GetCompetitions(ctx context.Context) ([]footballdata.Competition, error) {
	return []footballdata.Competition{
		{ID: 1, Name: "Mock Competition"},
	}, nil
}

func (s *TemplateService) GetCompetition(ctx context.Context, code string) (*footballdata.Competition, error) {
	return &footballdata.Competition{ID: 1, Code: code, Name: "Mock Competition"}, nil
}

func (s *TemplateService) JoinGlobalLeague(ctx context.Context, competitionID string, userID string) (*models.GlobalLeague, error) {
	return &models.GlobalLeague{}, nil
}

func (s *TemplateService) GetPredictionLeague(ctx context.Context, competitionID string, leagueID string) (any, error) {
	return &models.PredictionLeague{ID: 1, Name: "Premier League Predictors", JoinCode: "PL2026"}, nil
}

func (s *TemplateService) PutPredictionLeague(ctx context.Context, competitionID string, league models.PredictionLeague) (*models.PredictionLeague, error) {
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

func (s *TemplateService) GetTeam(ctx context.Context, teamID int) (*footballdata.Team, error) {
	return &footballdata.Team{
		ID:          teamID,
		Name:        "Mocked FC",
		ShortName:   "Mocked",
		Tla:         "MOC",
		Crest:       "https://example.com/crest.png",
		Address:     "123 Fake Street",
		Website:     "https://mockedfc.com",
		Founded:     1899,
		ClubColors:  "Red / White",
		Venue:       "Mock Stadium",
		MarketValue: 15000000,
		LastUpdated: time.Now().Format(time.RFC3339),
	}, nil
}
