package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddleware_SuperfluousWriteHeader(t *testing.T) {
	handler := &APIHandler{}

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := handler.AuthMiddleware(nextHandler)

	req := httptest.NewRequest(http.MethodGet, "/user/profile", nil)
	rec := httptest.NewRecorder()

	middleware.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected status code %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestStatusResponseWriter_DoubleWriteHeader(t *testing.T) {
	rec := httptest.NewRecorder()
	sw := &statusResponseWriter{ResponseWriter: rec, statusCode: http.StatusOK}

	sw.WriteHeader(http.StatusUnauthorized)
	sw.WriteHeader(http.StatusUnauthorized)

	if sw.statusCode != http.StatusUnauthorized {
		t.Errorf("expected status code %d, got %d", http.StatusUnauthorized, sw.statusCode)
	}
}
