package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"predictball_api/models"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var usersLoaded bool
var userLeaguesLoaded bool
var userLeagues map[string][]models.UserCompetitionLeagues

func (s *PredictballAPIService) initUsers() {
	if usersLoaded {
		return
	}
	data, err := os.ReadFile("data/users.json")
	if err == nil {
		json.Unmarshal(data, &s.users)
	}
	usersLoaded = true
}

func (s *PredictballAPIService) initUserLeagues() {
	if userLeaguesLoaded {
		return
	}
	userLeagues = make(map[string][]models.UserCompetitionLeagues)
	data, err := os.ReadFile("data/userLeagues.json")
	if err == nil {
		var uLeagues []models.UserLeagues
		json.Unmarshal(data, &uLeagues)
		for _, ul := range uLeagues {
			userLeagues[fmt.Sprint(ul.UserID)] = ul.Competitions
		}
	}
	userLeaguesLoaded = true
}

func (s *PredictballAPIService) saveUsers() {
	os.MkdirAll("data", 0755)
	data, _ := json.MarshalIndent(s.users, "", "  ")
	os.WriteFile("data/users.json", data, 0644)
}

func (s *PredictballAPIService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	s.mu.RLock()
	if !usersLoaded {
		s.mu.RUnlock()
		s.mu.Lock()
		s.initUsers()
		s.mu.Unlock()
		s.mu.RLock()
	}
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
	s.mu.RLock()
	if !usersLoaded {
		s.mu.RUnlock()
		s.mu.Lock()
		s.initUsers()
		s.mu.Unlock()
		s.mu.RLock()
	}
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if user.Username == req.Username {
			if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err == nil {
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
	s.mu.RLock()
	if !userLeaguesLoaded {
		s.mu.RUnlock()
		s.mu.Lock()
		s.initUserLeagues()
		s.mu.Unlock()
		s.mu.RLock()
	}
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
