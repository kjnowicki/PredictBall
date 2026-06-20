package services

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/url"
	"path/filepath"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"time"
)

func (s *PredictballAPIService) fetchMatchCachedDynamic(ctx context.Context, matchID string) (*footballdata.Match, error) {
	var apiMatch footballdata.Match
	endpoint := fmt.Sprintf("matches/%s", matchID)

	queryParams := url.Values{}
	h := fnv.New32a()
	h.Write([]byte(queryParams.Encode()))
	cacheBaseName := filepath.Join("cache", endpoint, fmt.Sprintf("%x", h.Sum32()))

	// Consider if fetchCached already returned something valid
	if readCache(s, cacheBaseName, &apiMatch) {
		return &apiMatch, nil
	}

	if err := s.fetchAPI(ctx, endpoint, nil, &apiMatch); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var ttl time.Duration
	switch apiMatch.Status {
	case "SCHEDULED", "TIMED":
		matchTime, err := time.Parse(time.RFC3339, apiMatch.UtcDate)
		hasLineups := len(apiMatch.HomeTeam.Lineup) > 0 || len(apiMatch.AwayTeam.Lineup) > 0
		if err == nil && now.Add(1*time.Hour).Before(matchTime) && !hasLineups {
			ttl = time.Until(matchTime.Add(-1 * time.Hour))
		} else {
			ttl = 10 * time.Minute
		}
	case "IN_PLAY", "PAUSED":
		ttl = 1 * time.Minute
	case "FINISHED":
		ttl = 24 * time.Hour * 365 * 20
	default:
		ttl = 10 * time.Minute
	}

	// Store new response mapped to our dynamically determined TTL
	writeCache(s, cacheBaseName, apiMatch, ttl)

	return &apiMatch, nil
}

func (s *PredictballAPIService) GetMatchDetails(ctx context.Context, matchID string) (*models.MatchDetails, error) {
	apiMatch, err := s.fetchMatchCachedDynamic(ctx, matchID)
	if err != nil {
		return nil, err
	}

	var homeScore, awayScore int
	if apiMatch.Score.FullTime.Home != nil {
		homeScore = *apiMatch.Score.FullTime.Home
	}
	if apiMatch.Score.FullTime.Away != nil {
		awayScore = *apiMatch.Score.FullTime.Away
	}

	scorers := make([]models.Player, 0)
	for _, g := range apiMatch.Goals {
		if g.Scorer.ID != 0 {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}
	}

	var homeLineup, homeBench, awayLineup, awayBench []models.Player
	for _, p := range apiMatch.HomeTeam.Lineup {
		homeLineup = append(homeLineup, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}
	for _, p := range apiMatch.HomeTeam.Bench {
		homeBench = append(homeBench, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}
	for _, p := range apiMatch.AwayTeam.Lineup {
		awayLineup = append(awayLineup, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}
	for _, p := range apiMatch.AwayTeam.Bench {
		awayBench = append(awayBench, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}

	var subs []models.Substitution
	for _, s := range apiMatch.Substitutions {
		subs = append(subs, models.Substitution{
			Minute:    s.Minute,
			TeamID:    s.Team.ID,
			TeamName:  s.Team.Name,
			PlayerOut: models.Player{ID: s.PlayerOut.ID, Name: s.PlayerOut.Name},
			PlayerIn:  models.Player{ID: s.PlayerIn.ID, Name: s.PlayerIn.Name},
		})
	}

	details := &models.MatchDetails{
		HomeScore:     homeScore,
		AwayScore:     awayScore,
		Scorers:       scorers,
		HomeLineup:    models.TeamSquad{TeamID: apiMatch.HomeTeam.ID, Players: homeLineup},
		HomeBench:     models.TeamSquad{TeamID: apiMatch.HomeTeam.ID, Players: homeBench},
		AwayLineup:    models.TeamSquad{TeamID: apiMatch.AwayTeam.ID, Players: awayLineup},
		AwayBench:     models.TeamSquad{TeamID: apiMatch.AwayTeam.ID, Players: awayBench},
		Substitutions: subs,
	}

	return details, nil
}

func (s *PredictballAPIService) GetMatch(ctx context.Context, compCode string, matchID string) (*models.Match, error) {
	compID, err := s.ResolveCompetitionID(ctx, compCode)
	if err != nil {
		return nil, err
	}

	apiMatch, err := s.fetchMatchCachedDynamic(ctx, matchID)
	if err != nil {
		return nil, err
	}

	var homeScore, awayScore int
	if apiMatch.Score.FullTime.Home != nil {
		homeScore = *apiMatch.Score.FullTime.Home
	}
	if apiMatch.Score.FullTime.Away != nil {
		awayScore = *apiMatch.Score.FullTime.Away
	}

	scorers := make([]models.Player, 0)
	for _, g := range apiMatch.Goals {
		if g.Scorer.ID != 0 {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}
	}

	var startTime time.Time
	if t, err := time.Parse(time.RFC3339, apiMatch.UtcDate); err == nil {
		startTime = t
	}

	var homeLineup, homeBench, awayLineup, awayBench []models.Player
	for _, p := range apiMatch.HomeTeam.Lineup {
		homeLineup = append(homeLineup, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}
	for _, p := range apiMatch.HomeTeam.Bench {
		homeBench = append(homeBench, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}
	for _, p := range apiMatch.AwayTeam.Lineup {
		awayLineup = append(awayLineup, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}
	for _, p := range apiMatch.AwayTeam.Bench {
		awayBench = append(awayBench, models.Player{ID: p.ID, Name: p.Name, Position: p.Position})
	}

	var subs []models.Substitution
	for _, sub := range apiMatch.Substitutions {
		subs = append(subs, models.Substitution{
			Minute:    sub.Minute,
			TeamID:    sub.Team.ID,
			TeamName:  sub.Team.Name,
			PlayerOut: models.Player{ID: sub.PlayerOut.ID, Name: sub.PlayerOut.Name},
			PlayerIn:  models.Player{ID: sub.PlayerIn.ID, Name: sub.PlayerIn.Name},
		})
	}

	match := &models.Match{
		ID:         apiMatch.ID,
		Matchday:   apiMatch.Matchday,
		HomeTeamID: apiMatch.HomeTeam.ID,
		AwayTeamID: apiMatch.AwayTeam.ID,
		StartTime:  startTime,
		Status:     models.MatchStatus(apiMatch.Status),
		MatchDetails: models.MatchDetails{
			HomeScore:     homeScore,
			AwayScore:     awayScore,
			Scorers:       scorers,
			HomeLineup:    models.TeamSquad{TeamID: apiMatch.HomeTeam.ID, Players: homeLineup},
			HomeBench:     models.TeamSquad{TeamID: apiMatch.HomeTeam.ID, Players: homeBench},
			AwayLineup:    models.TeamSquad{TeamID: apiMatch.AwayTeam.ID, Players: awayLineup},
			AwayBench:     models.TeamSquad{TeamID: apiMatch.AwayTeam.ID, Players: awayBench},
			Substitutions: subs,
		},
	}

	cacheBaseName := filepath.Join("cache", "schedules", compID)
	var schedule []models.Match
	if readCache(s, cacheBaseName, &schedule) {
		for i, m := range schedule {
			if m.ID == match.ID {
				schedule[i] = *match
				break
			}
		}
		writeCache(s, cacheBaseName, schedule, 24*time.Hour*365)
	}

	return match, nil
}
