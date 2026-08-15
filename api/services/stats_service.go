package services

import (
	"predictball_api/models"
	"strings"
	"sync"
	"time"
)

type StatsTracker struct {
	mu                sync.RWMutex
	totalHTTPRequests int64
	apiTotalRequests  int64
	apiCacheHits      int64
	apiCacheMisses    int64
	httpEndpointStats map[string]*models.EndpointStat
	apiEndpointStats  map[string]*models.EndpointStat
	recentErrors      []models.ErrorLogEntry
	maxErrors         int
}

var GlobalStatsTracker = NewStatsTracker(100)

func NewStatsTracker(maxErrors int) *StatsTracker {
	return &StatsTracker{
		httpEndpointStats: make(map[string]*models.EndpointStat),
		apiEndpointStats:  make(map[string]*models.EndpointStat),
		recentErrors:      make([]models.ErrorLogEntry, 0, maxErrors),
		maxErrors:         maxErrors,
	}
}

func (s *StatsTracker) RecordRequest(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.totalHTTPRequests++
	st, exists := s.httpEndpointStats[path]
	if !exists {
		st = &models.EndpointStat{Endpoint: path}
		s.httpEndpointStats[path] = st
	}
	st.TotalCount++
}

func (s *StatsTracker) RecordAPICacheHit(endpoint string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	endpoint = strings.TrimPrefix(endpoint, "/")
	s.apiTotalRequests++
	s.apiCacheHits++

	st, exists := s.apiEndpointStats[endpoint]
	if !exists {
		st = &models.EndpointStat{Endpoint: endpoint}
		s.apiEndpointStats[endpoint] = st
	}
	st.TotalCount++
	st.CacheHits++
}

func (s *StatsTracker) RecordAPICacheMiss(endpoint string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	endpoint = strings.TrimPrefix(endpoint, "/")
	s.apiTotalRequests++
	s.apiCacheMisses++

	st, exists := s.apiEndpointStats[endpoint]
	if !exists {
		st = &models.EndpointStat{Endpoint: endpoint}
		s.apiEndpointStats[endpoint] = st
	}
	st.TotalCount++
	st.CacheMisses++
}

func (s *StatsTracker) RecordError(endpoint, method, userID, errorMsg string, statusCode int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	st, exists := s.httpEndpointStats[endpoint]
	if !exists {
		st = &models.EndpointStat{Endpoint: endpoint}
		s.httpEndpointStats[endpoint] = st
	}
	st.ErrorCount++

	entry := models.ErrorLogEntry{
		Timestamp:  time.Now(),
		Endpoint:   endpoint,
		Method:     method,
		StatusCode: statusCode,
		UserID:     userID,
		Error:      errorMsg,
	}

	if len(s.recentErrors) >= s.maxErrors {
		s.recentErrors = s.recentErrors[1:]
	}
	s.recentErrors = append(s.recentErrors, entry)
}

func (s *StatsTracker) GetSummary() models.StatsSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	apiStatsCopy := make(map[string]*models.EndpointStat)
	for k, v := range s.apiEndpointStats {
		copyStat := *v
		apiStatsCopy[k] = &copyStat
	}

	httpStatsCopy := make(map[string]*models.EndpointStat)
	for k, v := range s.httpEndpointStats {
		copyStat := *v
		httpStatsCopy[k] = &copyStat
	}

	errorsCopy := make([]models.ErrorLogEntry, 0, len(s.recentErrors))
	if len(s.recentErrors) > 0 {
		errorsCopy = make([]models.ErrorLogEntry, len(s.recentErrors))
		copy(errorsCopy, s.recentErrors)
	}

	var apiHitRate float64
	if s.apiTotalRequests > 0 {
		apiHitRate = (float64(s.apiCacheHits) / float64(s.apiTotalRequests)) * 100
	}

	return models.StatsSummary{
		TotalHTTPRequests: s.totalHTTPRequests,
		APITotalRequests:  s.apiTotalRequests,
		APICacheHits:      s.apiCacheHits,
		APICacheMisses:    s.apiCacheMisses,
		APICacheHitRate:   apiHitRate,
		APIEndpointStats:  apiStatsCopy,
		HTTPEndpointStats: httpStatsCopy,
		RecentErrors:      errorsCopy,
	}
}
