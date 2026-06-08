package services

import (
	"context"
	"fmt"
	"predictball_api/models"
)

func (s *PredictballAPIService) GetUser(ctx context.Context, userID string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if user, exists := s.users[userID]; exists {
		return &user, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (s *PredictballAPIService) PutUser(ctx context.Context, user models.User) (*models.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if user.ID == 0 {
		user.ID = len(s.users) + 1
	}

	s.users[fmt.Sprint(user.ID)] = user
	return &user, nil
}
