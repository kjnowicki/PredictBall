package services

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"predictball_api/models"
	"testing"
	"time"
)

type testEnv struct {
	tempDir          string
	originalCwd      string
	svc              *PredictballAPIService
	compID           string
	season           string
	leaguesDir       string
	scheduleCacheDir string
}

func setupTestEnv(t *testing.T) *testEnv {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "predictball_retire_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	cwd, _ := os.Getwd()
	os.Chdir(tempDir)

	compID := "2000"
	season := "2026"
	leaguesDir := filepath.Join("data", "competitions", compID, "leagues")
	os.MkdirAll(leaguesDir, 0755)

	scheduleCacheDir := filepath.Join("cache", "schedules")
	os.MkdirAll(scheduleCacheDir, 0755)

	svc := NewFootballAPIService("dummy_token")

	return &testEnv{
		tempDir:          tempDir,
		originalCwd:      cwd,
		svc:              svc,
		compID:           compID,
		season:           season,
		leaguesDir:       leaguesDir,
		scheduleCacheDir: scheduleCacheDir,
	}
}

func (env *testEnv) teardown() {
	os.Chdir(env.originalCwd)
	os.RemoveAll(env.tempDir)
}

func TestRetireSeason_FutureMatchRejection(t *testing.T) {
	env := setupTestEnv(t)
	defer env.teardown()

	futureSchedule := []models.Match{
		{
			ID:        102,
			Matchday:  2,
			StartTime: time.Now().Add(24 * time.Hour),
			Status:    models.StatusScheduled,
		},
	}
	futureSchedBytes, _ := json.Marshal(futureSchedule)
	os.WriteFile(filepath.Join(env.scheduleCacheDir, "2000_2026_9999999999.json"), futureSchedBytes, 0644)

	err := env.svc.RetireSeason(context.Background(), env.compID, env.season)
	if err == nil {
		t.Errorf("expected error when retiring season with future match, got nil")
	}
}

func TestRetireSeason_MissingGlobalLeague(t *testing.T) {
	env := setupTestEnv(t)
	defer env.teardown()

	// Past schedule
	pastSchedule := []models.Match{
		{
			ID:        101,
			Matchday:  1,
			StartTime: time.Now().Add(-48 * time.Hour),
			Status:    models.StatusFinished,
		},
	}
	schedBytes, _ := json.Marshal(pastSchedule)
	os.WriteFile(filepath.Join(env.scheduleCacheDir, "2000_2026_9999999999.json"), schedBytes, 0644)

	// Ensure 0.json does not exist
	os.Remove(filepath.Join(env.leaguesDir, "0.json"))

	err := env.svc.RetireSeason(context.Background(), env.compID, env.season)
	if err == nil {
		t.Errorf("expected error when global league (0.json) is missing, got nil")
	}
}

func TestRetireSeason_Success(t *testing.T) {
	env := setupTestEnv(t)
	defer env.teardown()

	// 1. Create 0.json global league
	globalLeague := models.GlobalLeague{
		PredictionLeague: models.PredictionLeague{
			ID:       0,
			Name:     "Global League",
			JoinCode: "GLOBAL",
			Public:   true,
		},
		Users: []models.LeagueUser{
			{UserID: 1, Name: "ZeroUser", Points: 0},
			{UserID: 2, Name: "WinnerUser", Points: 100},
			{UserID: 3, Name: "ScorerUser", Points: 50},
		},
	}
	globalBytes, _ := json.MarshalIndent(globalLeague, "", "  ")
	os.WriteFile(filepath.Join(env.leaguesDir, "0.json"), globalBytes, 0644)

	// 2. Create private league 1.json
	privLeague := map[string]any{
		"id":       1,
		"name":     "Private League",
		"joinCode": "PRIV1",
		"public":   false,
		"userIds":  []any{1, 2, 3},
	}
	privBytes, _ := json.MarshalIndent(privLeague, "", "  ")
	os.WriteFile(filepath.Join(env.leaguesDir, "1.json"), privBytes, 0644)

	// 3. User predictions & powerups
	for _, uid := range []string{"1", "2", "3"} {
		uDir := filepath.Join("data", "users", uid, "competition", env.compID)
		os.MkdirAll(uDir, 0755)
		os.WriteFile(filepath.Join(uDir, "predictions.json"), []byte("[]"), 0644)
		os.WriteFile(filepath.Join(uDir, "powerups.json"), []byte("{}"), 0644)
	}

	// 4. Past schedule cache
	pastSchedule := []models.Match{
		{
			ID:        101,
			Matchday:  1,
			StartTime: time.Now().Add(-48 * time.Hour),
			Status:    models.StatusFinished,
		},
	}
	schedBytes, _ := json.Marshal(pastSchedule)
	os.WriteFile(filepath.Join(env.scheduleCacheDir, "2000_2026_9999999999.json"), schedBytes, 0644)

	// Execute retire season
	err := env.svc.RetireSeason(context.Background(), env.compID, env.season)
	if err != nil {
		t.Fatalf("unexpected error retiring season: %v", err)
	}

	// Assertions
	verifyGlobalLeagueArchive(t, env.leaguesDir, env.season)
	verifyResetGlobalLeague(t, env.leaguesDir)
	verifyPrunedPrivateLeague(t, env.leaguesDir)
	verifyUserFilesPurged(t, env.compID, []string{"1", "2", "3"})
}

func verifyGlobalLeagueArchive(t *testing.T, leaguesDir string, season string) {
	t.Helper()
	archivedPath := filepath.Join(leaguesDir, "archive", "0_"+season+".json")
	if _, err := os.Stat(archivedPath); os.IsNotExist(err) {
		t.Errorf("archived global league file does not exist at %s", archivedPath)
	}
}

func verifyResetGlobalLeague(t *testing.T, leaguesDir string) {
	t.Helper()
	newGlobalData, err := os.ReadFile(filepath.Join(leaguesDir, "0.json"))
	if err != nil {
		t.Fatalf("failed to read updated 0.json: %v", err)
	}
	var newGlobal models.GlobalLeague
	json.Unmarshal(newGlobalData, &newGlobal)

	if len(newGlobal.Users) != 2 {
		t.Errorf("expected 2 users in new global league (user 1 cut), got %d", len(newGlobal.Users))
	}
	for _, u := range newGlobal.Users {
		if u.Points != 0 {
			t.Errorf("expected user %d points reset to 0, got %d", u.UserID, u.Points)
		}
		if u.UserID == 1 {
			t.Errorf("user 1 (0 points) should have been cut from global league")
		}
	}
}

func verifyPrunedPrivateLeague(t *testing.T, leaguesDir string) {
	t.Helper()
	privData, err := os.ReadFile(filepath.Join(leaguesDir, "1.json"))
	if err != nil {
		t.Fatalf("failed to read updated 1.json: %v", err)
	}
	var newPriv map[string]any
	json.Unmarshal(privData, &newPriv)
	rawUserIDs := newPriv["userIds"].([]any)
	if len(rawUserIDs) != 2 {
		t.Errorf("expected 2 users in private league after cutting 0-pt user, got %d", len(rawUserIDs))
	}
}

func verifyUserFilesPurged(t *testing.T, compID string, userIDs []string) {
	t.Helper()
	for _, uid := range userIDs {
		uDir := filepath.Join("data", "users", uid, "competition", compID)
		if _, err := os.Stat(filepath.Join(uDir, "predictions.json")); !os.IsNotExist(err) {
			t.Errorf("predictions.json for user %s should have been deleted", uid)
		}
		if _, err := os.Stat(filepath.Join(uDir, "powerups.json")); !os.IsNotExist(err) {
			t.Errorf("powerups.json for user %s should have been deleted", uid)
		}
	}
}
