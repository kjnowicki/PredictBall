package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"predictball_api/models"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var usersLoaded bool

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
