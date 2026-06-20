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
