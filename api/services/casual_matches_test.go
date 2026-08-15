package services

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"predictball_api/models"
	footballdata "predictball_api/models/football-data"
	"testing"
	"time"
)

func TestGenerateCasualMatches(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "predictball_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	origWd, _ := os.Getwd()
	os.Chdir(tmpDir)
	defer os.Chdir(origWd)

	svc := NewFootballAPIService("test_token")
	compID := "2000"

	// Create competition detail
	compDir := filepath.Join("data", "competitions", compID)
	os.MkdirAll(compDir, 0755)
	compDetail := footballdata.Competition{
		ID:            2000,
		Name:          "Test Competition",
		Code:          "TEST",
		CurrentSeason: footballdata.Season{ID: 2026, StartDate: "2026-01-01", EndDate: "2026-12-31"},
	}
	compB, _ := json.Marshal(compDetail)
	os.WriteFile(filepath.Join(compDir, "detail.json"), compB, 0644)

	// Create mock schedule cache file with timestamp
	scheduleCacheDir := filepath.Join("cache", "schedules")
	os.MkdirAll(scheduleCacheDir, 0755)

	matches := []models.Match{
		{ID: 101, Matchday: 1, HomeTeamID: 1, AwayTeamID: 2, StartTime: time.Now()},
		{ID: 102, Matchday: 1, HomeTeamID: 3, AwayTeamID: 4, StartTime: time.Now()},
		{ID: 201, Matchday: 2, HomeTeamID: 1, AwayTeamID: 3, StartTime: time.Now().Add(24 * time.Hour)},
		{ID: 202, Matchday: 2, HomeTeamID: 2, AwayTeamID: 4, StartTime: time.Now().Add(24 * time.Hour)},
	}

	b, _ := json.Marshal(matches)
	os.WriteFile(filepath.Join(scheduleCacheDir, "2000_2026_9999999999.json"), b, 0644)

	ctx := context.Background()
	ids, byMatchday, err := svc.GenerateCasualMatches(ctx, compID)
	if err != nil {
		t.Fatalf("GenerateCasualMatches failed: %v", err)
	}

	if len(ids) != 4 {
		t.Fatalf("expected 4 casual match IDs (2 per matchday), got %d: %v", len(ids), ids)
	}

	if len(byMatchday["1"]) != 2 || len(byMatchday["2"]) != 2 {
		t.Fatalf("expected 2 matches per matchday in byMatchday map, got: %v", byMatchday)
	}

	// Verify persistence file exists
	path := filepath.Join("data", "competitions", compID, "casual_matches.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Errorf("casual_matches.json was not created at %s", path)
	}
}
