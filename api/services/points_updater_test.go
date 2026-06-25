package services

import (
	"predictball_api/models"
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
