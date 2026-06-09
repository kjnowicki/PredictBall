package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"predictball_api/models"
	"sync"
	"time"
)

type PredictballAPIService struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
	mu         sync.RWMutex
	FootballDataService

	users       map[string]models.User
	predictions map[string]models.Prediction
}

func NewFootballAPIService(apiKey string) *PredictballAPIService {
	svc := &PredictballAPIService{
		APIKey:      apiKey,
		BaseURL:     "https://api.football-data.org/v4",
		HTTPClient:  &http.Client{Timeout: 10 * time.Second},
		users:       make(map[string]models.User),
		predictions: make(map[string]models.Prediction),
	}
	svc.FootballDataService.apiClient = svc
	return svc
}

func readCache(s *PredictballAPIService, baseName string, target any) bool {
	s.mu.RLock()
	files, err := filepath.Glob(baseName + "_*.json")
	if err != nil || len(files) == 0 {
		s.mu.RUnlock()
		return false
	}

	var bestFile string
	var bestExp time.Time
	for _, f := range files {
		var expUnix int64
		if _, err := fmt.Sscanf(filepath.Base(f), filepath.Base(baseName)+"_%d.json", &expUnix); err == nil {
			exp := time.Unix(expUnix, 0)
			if exp.After(bestExp) {
				bestExp = exp
				bestFile = f
			}
		}
	}

	var data []byte
	var readErr error
	if time.Now().Before(bestExp) {
		data, readErr = os.ReadFile(bestFile)
	}
	s.mu.RUnlock()

	if len(files) > 1 {
		s.mu.Lock()
		for _, f := range files {
			if f != bestFile {
				_ = os.Remove(f)
			}
		}
		s.mu.Unlock()
	}

	if readErr == nil && len(data) > 0 {
		if err := json.Unmarshal(data, target); err == nil {
			return true
		}
	}
	return false
}

func writeCache(s *PredictballAPIService, baseName string, data any, duration time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Dir(baseName)
	if dir != "." {
		os.MkdirAll(dir, 0755)
	}

	if oldFiles, err := filepath.Glob(baseName + "_*.json"); err == nil {
		for _, f := range oldFiles {
			_ = os.Remove(f)
		}
	}

	exp := time.Now().Add(duration)
	newCacheFile := fmt.Sprintf("%s_%d.json", baseName, exp.Unix())
	if b, err := json.Marshal(data); err == nil {
		_ = os.WriteFile(newCacheFile, b, 0644)
	}
}

func (s *PredictballAPIService) fetchAPI(ctx context.Context, path string, query url.Values, target any) error {
	reqURL := fmt.Sprintf("%s/%s", s.BaseURL, path)
	if len(query) > 0 {
		reqURL = fmt.Sprintf("%s?%s", reqURL, query.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return err
	}

	req.Header.Set("X-Auth-Token", s.APIKey)
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("api responded with status: %d", resp.StatusCode)
	}

	return json.NewDecoder(resp.Body).Decode(target)
}
