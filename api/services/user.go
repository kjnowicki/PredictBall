package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"predictball_api/models"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var usersLoaded bool
var usersLastModified time.Time
var userLeaguesLoaded bool
var userLeaguesLastModified time.Time
var userLeagues map[string][]models.UserCompetitionLeagues

func (s *PredictballAPIService) initUsers() {
	info, err := os.Stat("data/users.json")
	if err != nil {
		usersLoaded = true
		return
	}
	if usersLoaded && !info.ModTime().After(usersLastModified) {
		return
	}

	data, err := os.ReadFile("data/users.json")
	if err == nil {
		json.Unmarshal(data, &s.users)
	}
	usersLoaded = true
	usersLastModified = info.ModTime()
}

func (s *PredictballAPIService) initUserLeagues() {
	info, err := os.Stat("data/userLeagues.json")
	if err != nil {
		if !userLeaguesLoaded {
			userLeagues = make(map[string][]models.UserCompetitionLeagues)
			userLeaguesLoaded = true
		}
		return
	}
	if userLeaguesLoaded && !info.ModTime().After(userLeaguesLastModified) {
		return // No external changes
	}

	newUserLeagues := make(map[string][]models.UserCompetitionLeagues)
	data, err := os.ReadFile("data/userLeagues.json")
	if err == nil {
		var uLeagues []models.UserLeagues
		json.Unmarshal(data, &uLeagues)
		for _, ul := range uLeagues {
			newUserLeagues[fmt.Sprint(ul.UserID)] = ul.Competitions
		}
	}
	userLeagues = newUserLeagues
	userLeaguesLoaded = true
	userLeaguesLastModified = info.ModTime()
}

func (s *PredictballAPIService) ensureUsersLoaded() {
	info, err := os.Stat("data/users.json")
	s.mu.RLock()
	needsUpdate := !usersLoaded || (err == nil && info.ModTime().After(usersLastModified))
	s.mu.RUnlock()

	if needsUpdate {
		s.mu.Lock()
		s.initUsers()
		s.mu.Unlock()
	}
}

func (s *PredictballAPIService) ensureUserLeaguesLoaded() {
	info, err := os.Stat("data/userLeagues.json")
	s.mu.RLock()
	needsUpdate := !userLeaguesLoaded || (err == nil && info.ModTime().After(userLeaguesLastModified))
	s.mu.RUnlock()

	if needsUpdate {
		s.mu.Lock()
		s.initUserLeagues()
		s.mu.Unlock()
	}
}

func (s *PredictballAPIService) saveUsers() {
	os.MkdirAll("data", 0755)
	data, _ := json.MarshalIndent(s.users, "", "  ")
	os.WriteFile("data/users.json", data, 0644)
	if info, err := os.Stat("data/users.json"); err == nil {
		usersLastModified = info.ModTime()
	}
}

func (s *PredictballAPIService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	s.ensureUsersLoaded()

	s.mu.RLock()
	defer s.mu.RUnlock()

	if user, exists := s.users[userID]; exists {
		user.Username = ""
		user.Password = ""
		return &user, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (s *PredictballAPIService) PutUser(ctx context.Context, user models.User) (*models.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	for _, u := range s.users {
		if u.Username == user.Username && fmt.Sprint(u.ID) != fmt.Sprint(user.ID) {
			return nil, fmt.Errorf("username already taken")
		}
	}

	if user.ID == 0 {
		user.ID = len(s.users) + 1
		user.NameLastChanged = time.Now()
	}

	if user.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %v", err)
		}
		user.Password = string(hash)
	} else if existing, ok := s.users[fmt.Sprint(user.ID)]; ok {
		user.Password = existing.Password
	}

	s.users[fmt.Sprint(user.ID)] = user

	s.saveUsers()

	safeUser := user
	safeUser.Username = ""
	safeUser.Password = ""
	return &safeUser, nil
}

func (s *PredictballAPIService) ChangePassword(ctx context.Context, userID string, oldPassword string, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	user, ok := s.users[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return fmt.Errorf("invalid old password")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %v", err)
	}
	user.Password = string(hash)

	s.users[userID] = user
	s.saveUsers()

	return nil
}

func (s *PredictballAPIService) UpdateDisplayName(ctx context.Context, userID string, displayName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	user, ok := s.users[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}

	user.DisplayName = displayName
	user.NameLastChanged = time.Now()

	s.users[userID] = user
	s.saveUsers()

	return nil
}

func (s *PredictballAPIService) DeleteUser(ctx context.Context, userID string, password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	user, ok := s.users[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return fmt.Errorf("invalid password")
	}

	delete(s.users, userID)
	s.saveUsers()

	return nil
}

func (s *PredictballAPIService) AuthenticateUser(ctx context.Context, req models.User) (*models.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	for idStr, user := range s.users {
		if user.Username == req.Username {
			if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err == nil {
				user.LastLoggedIn = time.Now()
				user.VisitCount++
				s.users[idStr] = user
				s.saveUsers()

				safeUser := user
				safeUser.Username = ""
				safeUser.Password = ""
				return &safeUser, nil
			}
		}
	}
	return nil, fmt.Errorf("invalid username or password")
}

func (s *PredictballAPIService) GetUserLeagues(ctx context.Context, userID string) (*models.UserLeagues, error) {
	s.ensureUserLeaguesLoaded()

	s.mu.RLock()
	userComps, exists := userLeagues[userID]
	s.mu.RUnlock()

	uid, err := strconv.Atoi(userID)
	if err != nil {
		return nil, err
	}

	if !exists {
		return &models.UserLeagues{UserID: uid, Competitions: []models.UserCompetitionLeagues{}}, nil
	}

	return &models.UserLeagues{UserID: uid, Competitions: userComps}, nil
}

func (s *PredictballAPIService) GetAdminUserList(ctx context.Context) ([]models.AdminUserDetail, error) {
	s.ensureUsersLoaded()

	s.mu.RLock()
	defer s.mu.RUnlock()

	var details []models.AdminUserDetail

	for idStr, user := range s.users {
		uniqueMatches := make(map[int]bool)
		totalPredictions := 0

		userCompDir := filepath.Join("data", "users", idStr, "competition")
		if entries, err := os.ReadDir(userCompDir); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					predFile := filepath.Join(userCompDir, entry.Name(), "predictions.json")
					if b, err := os.ReadFile(predFile); err == nil {
						var preds []models.Prediction
						if err := json.Unmarshal(b, &preds); err == nil {
							totalPredictions += len(preds)
							for _, p := range preds {
								uniqueMatches[p.MatchID] = true
							}
						}
					}
				}
			}
		}

		detail := models.AdminUserDetail{
			ID:                user.ID,
			Username:          user.Username,
			DisplayName:       user.DisplayName,
			NameLastChanged:   user.NameLastChanged,
			LastLoggedIn:      user.LastLoggedIn,
			VisitCount:        user.VisitCount,
			UniquePredictions: len(uniqueMatches),
			TotalPredictions:  totalPredictions,
		}
		details = append(details, detail)
	}

	return details, nil
}

func (s *PredictballAPIService) AdminDeleteUser(ctx context.Context, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	if _, ok := s.users[userID]; !ok {
		return fmt.Errorf("user not found")
	}

	delete(s.users, userID)
	s.saveUsers()

	// Clean up user folder in data/users/{userID}
	safeUserID := sanitizeSegment(userID)
	userDir := filepath.Join("data", "users", safeUserID)
	_ = os.RemoveAll(userDir)

	return nil
}

func (s *PredictballAPIService) AdminUpdateDisplayName(ctx context.Context, userID string, displayName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	user, ok := s.users[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}

	user.DisplayName = displayName
	user.NameLastChanged = time.Now()

	s.users[userID] = user
	s.saveUsers()

	return nil
}

func (s *PredictballAPIService) GetStats(ctx context.Context) models.StatsSummary {
	return GlobalStatsTracker.GetSummary()
}

func (s *PredictballAPIService) UpdateUserLeagueViewPreference(ctx context.Context, userID string, leagueID string, viewOnlyCasual bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.initUsers()

	user, ok := s.users[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}

	if user.LeagueViewPreferences == nil {
		user.LeagueViewPreferences = make(map[string]bool)
	}

	user.LeagueViewPreferences[leagueID] = viewOnlyCasual
	s.users[userID] = user
	s.saveUsers()

	return nil
}
