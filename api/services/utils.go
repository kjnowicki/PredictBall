package services

import (
	"path/filepath"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
)

// sanitizeSegment extracts the base component of a path segment to prevent path traversal vulnerabilities.
func sanitizeSegment(s string) string {
	if s == "" {
		return ""
	}
	base := filepath.Base(filepath.Clean(s))
	if base == "." || base == ".." || base == "/" || base == "\\" {
		return ""
	}
	return base
}


func resolveRegularTimeScore(score footballdata.MatchScore) (int, int) {
	var homeScore, awayScore int
	if (score.Duration == "EXTRA_TIME" || score.Duration == "PENALTY_SHOOTOUT") &&
		score.RegularTime.Home != nil && score.RegularTime.Away != nil {
		homeScore = *score.RegularTime.Home
		awayScore = *score.RegularTime.Away
	} else {
		if score.FullTime.Home != nil {
			homeScore = *score.FullTime.Home
		}
		if score.FullTime.Away != nil {
			awayScore = *score.FullTime.Away
		}
	}
	return homeScore, awayScore
}

func filterRegularTimeScorers(goals []footballdata.Goal) []models.Player {
	scorers := make([]models.Player, 0)
	for _, g := range goals {
		if g.Scorer.ID != 0 && g.Minute <= 90 && g.Type != "OWN" {
			scorers = append(scorers, models.Player{
				ID:   g.Scorer.ID,
				Name: g.Scorer.Name,
			})
		}
	}
	return scorers
}

func resolveFullTimeScore(score footballdata.MatchScore) (int, int) {
	var homeScore, awayScore int
	if score.FullTime.Home != nil {
		homeScore = *score.FullTime.Home
	}
	if score.FullTime.Away != nil {
		awayScore = *score.FullTime.Away
	}
	return homeScore, awayScore
}
