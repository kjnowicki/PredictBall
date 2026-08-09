package services

import (
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"testing"
)

func TestGetMatchdayKey(t *testing.T) {
	m1 := models.Match{Matchday: 3, Stage: "GROUP_STAGE"}
	if key := getMatchdayKey(m1); key != "3" {
		t.Errorf("expected 3, got %s", key)
	}

	m2 := models.Match{Matchday: 0, Stage: "FINAL"}
	if key := getMatchdayKey(m2); key != "FINAL" {
		t.Errorf("expected FINAL, got %s", key)
	}
}

func TestGetMatchdayMultiplier(t *testing.T) {
	// Test with N = 24 (e.g. Euro group stage max matches)
	N := 24
	tests := []struct {
		numMatches int
		expected   int
	}{
		{1, 4},  // Final / Third place play-off
		{2, 3},  // Semi-finals
		{3, 3},  // Intermediate count
		{4, 3},  // Quarter-finals
		{5, 2},  // Lower bound of 2x
		{8, 2},  // Round of 16 (8 matches, which is <= N/2)
		{12, 2}, // Upper bound of 2x (12 matches, which is <= N/2)
		{13, 1}, // Over N/2 (13 > 12)
		{24, 1}, // Group stage matchdays (24 matches)
	}

	for _, tc := range tests {
		mult := getMatchdayMultiplier(tc.numMatches, N)
		if mult != tc.expected {
			t.Errorf("for numMatches=%d, N=%d: expected %dx, got %dx", tc.numMatches, N, tc.expected, mult)
		}
	}
}

func TestPowerupRestrictions(t *testing.T) {
	// Scoring system
	scoring := &models.ScoringSystem{
		ScoreExact: 5,
		Result:     3,
	}

	// Match and prediction
	match := models.Match{
		ID:       1,
		Matchday: 1,
		Status:   "FINISHED",
		MatchDetails: models.MatchDetails{
			HomeScore: 2,
			AwayScore: 1,
		},
	}
	pred := models.Prediction{
		MatchID:   1,
		HomeScore: 2,
		AwayScore: 1,
	}

	// Case 1: tripleScore with global multiplier (mult > 1) -> should be ignored (mult = 4 since numMatches = 1, N = 24)
	{
		activePowerup := "tripleScore"
		numMatches := 1
		N := 24
		mult := getMatchdayMultiplier(numMatches, N)
		if mult > 1 && activePowerup == "tripleScore" {
			activePowerup = ""
		}
		pts := calculatePointsForPrediction(match, pred, activePowerup, 0, scoring)
		// Since activePowerup was cleared to "", pts should be 8 (Exact 5 + Result 3).
		// (if it wasn't cleared, pts would be 24).
		if pts != 8 {
			t.Errorf("expected 8 pts, got %d", pts)
		}
	}

	// Case 2: tripleScore with no global multiplier (mult == 1, e.g. numMatches = 24, N = 24)
	{
		activePowerup := "tripleScore"
		numMatches := 24
		N := 24
		mult := getMatchdayMultiplier(numMatches, N)
		if mult > 1 && activePowerup == "tripleScore" {
			activePowerup = ""
		}
		pts := calculatePointsForPrediction(match, pred, activePowerup, 0, scoring)
		// Active powerup should not be cleared, pts should be 24 (8 * 3).
		if pts != 24 {
			t.Errorf("expected 24 pts, got %d", pts)
		}
	}

	// Case 3: reversal with numMatches <= 2 (e.g. numMatches = 2) -> should be ignored
	{
		activePowerup := "reversal"
		numMatches := 2
		// Actual: 2 - 1, Prediction: 1 - 2. With reversal, prediction is swapped to 2 - 1, so exact matches.
		reversalPred := models.Prediction{
			MatchID:   1,
			HomeScore: 1,
			AwayScore: 2,
		}
		if numMatches <= 2 && activePowerup == "reversal" {
			activePowerup = ""
		}
		pts := calculatePointsForPrediction(match, reversalPred, activePowerup, 0, scoring)
		// Since activePowerup was cleared to "", pts should be 0 because 1-2 does not match actual 2-1 and has wrong result.
		if pts != 0 {
			t.Errorf("expected 0 pts, got %d", pts)
		}
	}

	// Case 4: reversal with numMatches > 2 (e.g. numMatches = 5) -> should be applied
	{
		activePowerup := "reversal"
		numMatches := 5
		reversalPred := models.Prediction{
			MatchID:   1,
			HomeScore: 1,
			AwayScore: 2,
		}
		if numMatches <= 2 && activePowerup == "reversal" {
			activePowerup = ""
		}
		pts := calculatePointsForPrediction(match, reversalPred, activePowerup, 0, scoring)
		// Active powerup is not cleared, so prediction is swapped to 2-1, yielding 8 pts.
		if pts != 8 {
			t.Errorf("expected 8 pts, got %d", pts)
		}
	}
}

func TestDoubleNoneScorerInZeroZeroMatch(t *testing.T) {
	scoring := &models.ScoringSystem{
		ScoreExact:     5,
		Result:         3,
		ScoreHomeExact: 1,
		ScoreAwayExact: 1,
		ScoreDif:       2,
		Scorer:         2,
		BothScorers:    3,
	}

	// 0:0 match with 0 actual scorers
	match := models.Match{
		ID:       1,
		Matchday: 1,
		Status:   "FINISHED",
		MatchDetails: models.MatchDetails{
			HomeScore: 0,
			AwayScore: 0,
			Scorers:   []models.Player{},
		},
	}

	// User predicts 0:0 and double 'None' (ScorerID=0, doubleScorerID=0 with doubleScorer powerup)
	pred := models.Prediction{
		MatchID:   1,
		HomeScore: 0,
		AwayScore: 0,
		ScorerID:  0,
	}

	pts := calculatePointsForPrediction(match, pred, "doubleScorer", 0, scoring)

	// Base exact score points:
	// Exact (5) + Result (3) + HomeExact (1) + AwayExact (1) + GoalDif (2) = 12 pts
	// Scorer points:
	// 1st 'None' correct (2) + 2nd 'None' correct (2) + BothScorers bonus (3) = 7 pts
	// Total = 19 pts
	expectedScorerPts := scoring.Scorer + scoring.Scorer + scoring.BothScorers // 2 + 2 + 3 = 7
	expectedTotalPts := 12 + expectedScorerPts                                  // 19

	if pts != expectedTotalPts {
		t.Errorf("expected %d pts for 0:0 match with double None scorer, got %d", expectedTotalPts, pts)
	}
}

func TestRegularTimeHelpers(t *testing.T) {
	// 1. Test resolveRegularTimeScore
	t.Run("resolveRegularTimeScore", func(t *testing.T) {
		h1 := 1
		a1 := 1
		h2 := 2
		a2 := 1

		// Case A: Regular duration, regularTime nil
		scoreA := footballdata.MatchScore{
			Winner:   "DRAW",
			Duration: "REGULAR",
			FullTime: footballdata.TeamScore{Home: &h1, Away: &a1},
		}
		home, away := resolveRegularTimeScore(scoreA)
		if home != 1 || away != 1 {
			t.Errorf("expected 1-1, got %d-%d", home, away)
		}

		// Case B: Extra time duration, regularTime set
		scoreB := footballdata.MatchScore{
			Winner:      "HOME_TEAM",
			Duration:    "EXTRA_TIME",
			FullTime:    footballdata.TeamScore{Home: &h2, Away: &a2},
			RegularTime: footballdata.TeamScore{Home: &h1, Away: &a1},
		}
		home, away = resolveRegularTimeScore(scoreB)
		if home != 1 || away != 1 {
			t.Errorf("expected 1-1, got %d-%d", home, away)
		}

		// Case C: Penalty shootout duration, regularTime set
		scoreC := footballdata.MatchScore{
			Winner:      "HOME_TEAM",
			Duration:    "PENALTY_SHOOTOUT",
			FullTime:    footballdata.TeamScore{Home: &h2, Away: &a2},
			RegularTime: footballdata.TeamScore{Home: &h1, Away: &a1},
		}
		home, away = resolveRegularTimeScore(scoreC)
		if home != 1 || away != 1 {
			t.Errorf("expected 1-1, got %d-%d", home, away)
		}
	})

	// 2. Test filterRegularTimeScorers
	t.Run("filterRegularTimeScorers", func(t *testing.T) {
		goals := []footballdata.Goal{
			{
				Minute: 30,
				Type:   "REGULAR",
				Scorer: footballdata.Scorer{ID: 101, Name: "Player One"},
			},
			{
				Minute: 45,
				Type:   "PENALTY",
				Scorer: footballdata.Scorer{ID: 102, Name: "Player Two"},
			},
			{
				Minute: 60,
				Type:   "OWN",
				Scorer: footballdata.Scorer{ID: 103, Name: "Player Three"}, // Own goal scorer
			},
			{
				Minute: 95, // Extra time goal
				Type:   "REGULAR",
				Scorer: footballdata.Scorer{ID: 104, Name: "Player Four"},
			},
		}

		scorers := filterRegularTimeScorers(goals)
		if len(scorers) != 2 {
			t.Fatalf("expected 2 scorers, got %d", len(scorers))
		}

		if scorers[0].ID != 101 || scorers[0].Name != "Player One" {
			t.Errorf("expected scorer 101 Player One, got %d %s", scorers[0].ID, scorers[0].Name)
		}

		if scorers[1].ID != 102 || scorers[1].Name != "Player Two" {
			t.Errorf("expected scorer 102 Player Two, got %d %s", scorers[1].ID, scorers[1].Name)
		}
	})
}
