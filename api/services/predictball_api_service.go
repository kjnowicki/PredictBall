package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"sync"
	"time"
)

type PredictballAPIService struct {
	APIKey         string
	BaseURL        string
	HTTPClient     *http.Client
	mu             sync.RWMutex
	cachedSchedule []models.Match
	cacheExpiresAt time.Time
}

func NewFootballAPIService(apiKey string) *PredictballAPIService {
	return &PredictballAPIService{
		APIKey:     apiKey,
		BaseURL:    "https://api.football-data.org/v4",
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *PredictballAPIService) fetchAPI(ctx context.Context, path string, target any) error {
	url := fmt.Sprintf("%s/%s", s.BaseURL, path)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("X-Auth-Token", s.APIKey)
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("api responded with status: %d", resp.StatusCode)
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func (s *PredictballAPIService) GetMatchSchedule(ctx context.Context) ([]models.Match, error) {
	s.mu.RLock()
	if time.Now().Before(s.cacheExpiresAt) && s.cachedSchedule != nil {
		matches := s.cachedSchedule
		s.mu.RUnlock()
		return matches, nil
	}
	s.mu.RUnlock()

	var apiData struct {
		Filters   any `json:"filters"`
		ResultSet struct {
			Count  int    `json:"count"`
			First  string `json:"first"`
			Last   string `json:"last"`
			Played int    `json:"played"`
		} `json:"resultSet"`
		Competition footballdata.Competition `json:"competition"`
		Matches     []footballdata.Match     `json:"matches"`
	}

	if err := s.fetchAPI(ctx, "matches", &apiData); err != nil {
		return nil, err
	}

	var schedule []models.Match
	for _, m := range apiData.Matches {
		var homeScore, awayScore int
		if m.Score.FullTime.Home != nil {
			homeScore = *m.Score.FullTime.Home
		}
		if m.Score.FullTime.Away != nil {
			awayScore = *m.Score.FullTime.Away
		}

		var scorers []models.Player
		for _, g := range m.Goals {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}

		var startTime time.Time
		if t, err := time.Parse(time.RFC3339, m.UtcDate); err == nil {
			startTime = t
		}

		schedule = append(schedule, models.Match{
			ID:         m.ID,
			HomeTeamID: m.HomeTeam.ID,
			AwayTeamID: m.AwayTeam.ID,
			StartTime:  startTime,
			Status:     models.MatchStatus(m.Status),
			MatchDetails: models.MatchDetails{
				HomeScore: homeScore,
				AwayScore: awayScore,
				Scorers:   scorers,
			},
		})
	}

	s.mu.Lock()
	s.cachedSchedule = schedule
	s.cacheExpiresAt = time.Now().Add(30 * time.Minute)
	s.mu.Unlock()

	return schedule, nil
}

// =========================================================================
// NOTE: Go will force you to implement ALL the other methods from the
// APIService interface (GetMatchDetails, GetUser, PutUser, etc.) on this struct,
// otherwise it won't compile.
// For now, you can stub the rest out like this so it compiles:
// =========================================================================

func (s *PredictballAPIService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	return nil, nil
}
func (s *PredictballAPIService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	return nil, nil
}
func (s *PredictballAPIService) PutUser(ctx context.Context, user models.User) (*models.User, error) {
	return nil, nil
}
func (s *PredictballAPIService) GetPredictionLeague(ctx context.Context, leagueID string) (*models.PredictionLeague, error) {
	return nil, nil
}
func (s *PredictballAPIService) PutPredictionLeague(ctx context.Context, league models.PredictionLeague) (*models.PredictionLeague, error) {
	return nil, nil
}
func (s *PredictballAPIService) GetPrediction(ctx context.Context, predictionID string) (*models.Prediction, error) {
	return nil, nil
}
func (s *PredictballAPIService) PutPrediction(ctx context.Context, prediction models.Prediction) (*models.Prediction, error) {
	return nil, nil
}
func (s *PredictballAPIService) UpdatePrediction(ctx context.Context, predictionID string, prediction models.Prediction) (*models.Prediction, error) {
	return nil, nil
}
func (s *PredictballAPIService) GetScoringSystem(ctx context.Context) (*models.ScoringSystem, error) {
	return nil, nil
}
func (s *PredictballAPIService) GetTeamSquad(ctx context.Context, teamID string) (*models.TeamSquad, error) {
	return nil, nil
}
