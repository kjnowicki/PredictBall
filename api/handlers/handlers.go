package handlers

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"predictball_api/models"
	"predictball_api/services"
	"strconv"
	"strings"
	"time"
)

type contextKey string
const userIDKey contextKey = "userID"

type SessionEncryptor struct {
	key []byte
}

var defaultSessionKey = []byte("change_this_default_session_key_") // Exactly 32 bytes

func NewSessionEncryptor() *SessionEncryptor {
	keyHex := os.Getenv("SESSION_KEY")
	if keyHex != "" {
		key, err := hex.DecodeString(keyHex)
		if err == nil && len(key) == 32 {
			return &SessionEncryptor{key: key}
		}
	}
	return &SessionEncryptor{key: defaultSessionKey}
}

func (e *SessionEncryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

func (e *SessionEncryptor) Decrypt(ciphertextHex string) (string, error) {
	ciphertext, err := hex.DecodeString(ciphertextHex)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, actualCiphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, actualCiphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

type APIHandler struct {
	Service          services.APIService
	SessionEncryptor *SessionEncryptor
}

func NewAPIHandler(svc services.APIService) *APIHandler {
	return &APIHandler{
		Service:          svc,
		SessionEncryptor: NewSessionEncryptor(),
	}
}

func (h *APIHandler) setSessionCookie(w http.ResponseWriter, r *http.Request, userID int) {
	expiration := time.Now().Add(24 * time.Hour)
	plaintext := fmt.Sprintf("%d:%d", userID, expiration.Unix())
	encrypted, err := h.SessionEncryptor.Encrypt(plaintext)
	if err != nil {
		log.Printf("failed to encrypt session cookie: %v", err)
		return
	}

	secure := false
	origin := r.Header.Get("Origin")
	if strings.HasPrefix(strings.ToLower(origin), "https://") {
		secure = true
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    encrypted,
		Path:     "/",
		Expires:  expiration,
		MaxAge:   86400,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *APIHandler) authorizeUser(r *http.Request, userID string) bool {
	authID, ok := r.Context().Value(userIDKey).(string)
	return ok && authID == userID
}

func (h *APIHandler) authorizeAdmin(r *http.Request) bool {
	adminToken := os.Getenv("ADMIN_TOKEN")
	if adminToken == "" {
		adminToken = "admin_secret"
	}
	reqToken := r.Header.Get("X-Admin-Token")
	if reqToken == "" {
		reqToken = r.Header.Get("Authorization")
		reqToken = strings.TrimPrefix(reqToken, "Bearer ")
	}
	return reqToken != "" && reqToken == adminToken
}

func (h *APIHandler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		path := r.URL.Path
		if (path == "/user/authenticate" && r.Method == http.MethodPost) || (path == "/user" && r.Method == http.MethodPut) || strings.HasPrefix(path, "/admin/") {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie("session")
		if err != nil {
			http.Error(w, "Unauthorized: missing session cookie", http.StatusUnauthorized)
			return
		}

		userID, err := h.decryptSession(cookie.Value)
		if err != nil {
			http.Error(w, "Unauthorized: invalid session", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *APIHandler) decryptSession(cookieValue string) (string, error) {
	decrypted, err := h.SessionEncryptor.Decrypt(cookieValue)
	if err != nil {
		return "", err
	}
	parts := strings.Split(decrypted, ":")
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid session format")
	}
	userID := parts[0]
	expiresUnix, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return "", err
	}
	if time.Now().Unix() > expiresUnix {
		return "", fmt.Errorf("session expired")
	}
	return userID, nil
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *APIHandler) HandleGetMatchSchedule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	season := r.URL.Query().Get("season")
	schedule, err := h.Service.GetMatchSchedule(r.Context(), id, season)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, schedule)
}

func (h *APIHandler) HandleRetireSeason(w http.ResponseWriter, r *http.Request) {
	if !h.authorizeAdmin(r) {
		http.Error(w, "Forbidden: invalid or missing admin token", http.StatusForbidden)
		return
	}

	compId := r.PathValue("compId")
	season := r.PathValue("season")
	if season == "" {
		season = r.URL.Query().Get("season")
	}
	if strings.TrimSpace(season) == "" {
		http.Error(w, "Bad Request: season query or path parameter is required", http.StatusBadRequest)
		return
	}

	err := h.Service.RetireSeason(r.Context(), compId, season)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{
		"message":       "season retired successfully",
		"competitionId": compId,
		"season":        season,
	})
}

func (h *APIHandler) HandleGetMatch(w http.ResponseWriter, r *http.Request) {
	compId := r.PathValue("compId")
	matchId := r.PathValue("matchId")
	match, err := h.Service.GetMatch(r.Context(), compId, matchId)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, match)
}

func (h *APIHandler) HandleGetMatchDetails(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	details, err := h.Service.GetMatchDetails(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, details)
}

func (h *APIHandler) HandleGetCompetitions(w http.ResponseWriter, r *http.Request) {
	comps, err := h.Service.GetCompetitions(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, comps)
}

func (h *APIHandler) HandleGetCompetition(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("id")
	comp, err := h.Service.GetCompetition(r.Context(), code)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, comp)
}

func (h *APIHandler) HandleJoinGlobalLeague(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.URL.Query().Get("user")
	if !h.authorizeUser(r, userID) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', userID='%s'", authID, userID), http.StatusForbidden)
		return
	}
	league, err := h.Service.JoinGlobalLeague(r.Context(), id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, league)
}

func (h *APIHandler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := h.Service.GetUser(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, user)
}

func (h *APIHandler) HandleGetUserLeagues(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !h.authorizeUser(r, id) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', id='%s'", authID, id), http.StatusForbidden)
		return
	}
	leagues, err := h.Service.GetUserLeagues(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, leagues)
}

func (h *APIHandler) HandleAuthenticateUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	authenticatedUser, err := h.Service.AuthenticateUser(r.Context(), user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	h.setSessionCookie(w, r, authenticatedUser.ID)

	WriteJSON(w, http.StatusOK, authenticatedUser)
}

func (h *APIHandler) HandlePutUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	created, err := h.Service.PutUser(r.Context(), user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.setSessionCookie(w, r, created.ID)

	WriteJSON(w, http.StatusOK, created)
}

func (h *APIHandler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !h.authorizeUser(r, id) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', id='%s'", authID, id), http.StatusForbidden)
		return
	}
	var req struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	err := h.Service.ChangePassword(r.Context(), id, req.OldPassword, req.NewPassword)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "success"})
}

func (h *APIHandler) HandleUpdateDisplayName(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !h.authorizeUser(r, id) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', id='%s'", authID, id), http.StatusForbidden)
		return
	}
	var req struct {
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	err := h.Service.UpdateDisplayName(r.Context(), id, req.DisplayName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"message": "success"})
}

func (h *APIHandler) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !h.authorizeUser(r, id) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', id='%s'", authID, id), http.StatusForbidden)
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	err := h.Service.DeleteUser(r.Context(), id, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	// Clear session cookie
	secure := false
	origin := r.Header.Get("Origin")
	if strings.HasPrefix(strings.ToLower(origin), "https://") {
		secure = true
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})

	WriteJSON(w, http.StatusOK, map[string]string{"message": "success"})
}

func (h *APIHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	secure := false
	origin := r.Header.Get("Origin")
	if strings.HasPrefix(strings.ToLower(origin), "https://") {
		secure = true
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
	WriteJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func (h *APIHandler) HandleGetCompetitionLeagues(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.URL.Query().Get("user")
	if !h.authorizeUser(r, userID) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', userID='%s'", authID, userID), http.StatusForbidden)
		return
	}
	leagues, err := h.Service.GetCompetitionLeagues(r.Context(), id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, leagues)
}

func (h *APIHandler) HandleJoinLeagueByCode(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.URL.Query().Get("user")
	if !h.authorizeUser(r, userID) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', userID='%s'", authID, userID), http.StatusForbidden)
		return
	}
	var req struct {
		JoinCode string `json:"joinCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	league, err := h.Service.JoinLeagueByCode(r.Context(), id, userID, req.JoinCode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, league)
}

func (h *APIHandler) HandleGetPredictionLeague(w http.ResponseWriter, r *http.Request) {
	compId := r.PathValue("compId")
	leagueId := r.PathValue("leagueId")

	authID, ok := r.Context().Value(userIDKey).(string)
	if !ok || authID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	league, err := h.Service.GetPredictionLeague(r.Context(), compId, leagueId)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Authorize league access
	leagueJSON, err := json.Marshal(league)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var leagueCheck struct {
		ID     int  `json:"id"`
		Public bool `json:"public"`
		Users  []struct {
			UserID int `json:"userId"`
		} `json:"users"`
		UserIDs []int `json:"userIds"`
	}
	if err := json.Unmarshal(leagueJSON, &leagueCheck); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !leagueCheck.Public {
		uid, _ := strconv.Atoi(authID)
		isMember := false
		for _, u := range leagueCheck.Users {
			if u.UserID == uid {
				isMember = true
				break
			}
		}
		for _, uID := range leagueCheck.UserIDs {
			if uID == uid {
				isMember = true
				break
			}
		}
		if !isMember {
			http.Error(w, "Forbidden: you are not a member of this private league", http.StatusForbidden)
			return
		}
	}

	WriteJSON(w, http.StatusOK, league)
}

func (h *APIHandler) HandlePutPredictionLeague(w http.ResponseWriter, r *http.Request) {
	compId := r.PathValue("compId")
	userID := r.URL.Query().Get("user")
	if !h.authorizeUser(r, userID) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', userID='%s'", authID, userID), http.StatusForbidden)
		return
	}
	var league models.PredictionLeague

	if err := json.NewDecoder(r.Body).Decode(&league); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	created, err := h.Service.PutPredictionLeague(r.Context(), compId, userID, league)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, created)
}

func (h *APIHandler) HandleGetPredictions(w http.ResponseWriter, r *http.Request) {
	userId := r.PathValue("id")
	authID, ok := r.Context().Value(userIDKey).(string)
	if !ok || authID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	compId := r.PathValue("compId")
	var req struct {
		MatchIDs []int `json:"matchIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	preds, err := h.Service.GetPredictions(r.Context(), userId, compId, req.MatchIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// If requesting someone else's predictions, only allow predictions for matches that have already started (locked)
	if authID != userId {
		schedule, err := h.Service.GetMatchSchedule(r.Context(), compId)
		if err != nil {
			http.Error(w, "Failed to load match schedule for verification: "+err.Error(), http.StatusInternalServerError)
			return
		}

		lockedMatches := make(map[int]bool)
		for _, m := range schedule {
			isPredictable := (string(m.Status) == "SCHEDULED" || string(m.Status) == "TIMED" || string(m.Status) == "LINEUPS-READY") && m.StartTime.After(time.Now())
			if !isPredictable {
				lockedMatches[m.ID] = true
			}
		}

		var filteredPreds []models.Prediction
		for _, p := range preds {
			if lockedMatches[p.MatchID] {
				filteredPreds = append(filteredPreds, p)
			}
		}
		preds = filteredPreds
	}

	WriteJSON(w, http.StatusOK, preds)
}

func (h *APIHandler) HandlePutPrediction(w http.ResponseWriter, r *http.Request) {
	userId := r.PathValue("id")
	if !h.authorizeUser(r, userId) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', userId='%s'", authID, userId), http.StatusForbidden)
		return
	}
	compId := r.PathValue("compId")
	matchIdStr := r.PathValue("matchId")
	matchId, err := strconv.Atoi(matchIdStr)
	if err != nil {
		http.Error(w, "invalid match id", http.StatusBadRequest)
		return
	}

	var pred models.Prediction
	if err := json.NewDecoder(r.Body).Decode(&pred); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	pred.MatchID = matchId
	pred.UserID, _ = strconv.Atoi(userId)

	created, err := h.Service.PutPrediction(r.Context(), userId, compId, pred)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, created)
}

func (h *APIHandler) HandleGetPowerups(w http.ResponseWriter, r *http.Request) {
	userId := r.PathValue("id")
	authID, ok := r.Context().Value(userIDKey).(string)
	if !ok || authID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	compId := r.PathValue("compId")

	data, err := h.Service.GetPowerups(r.Context(), userId, compId)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// If requesting someone else's powerups, mask powerups for matches that have not started yet (not locked)
	if authID != userId {
		schedule, err := h.Service.GetMatchSchedule(r.Context(), compId)
		if err != nil {
			http.Error(w, "Failed to load match schedule for verification: "+err.Error(), http.StatusInternalServerError)
			return
		}

		lockedMatches := make(map[int]bool)
		for _, m := range schedule {
			isPredictable := (string(m.Status) == "SCHEDULED" || string(m.Status) == "TIMED" || string(m.Status) == "LINEUPS-READY") && m.StartTime.After(time.Now())
			if !isPredictable {
				lockedMatches[m.ID] = true
			}
		}

		if data != nil && len(data.Matchdays) > 0 {
			var filteredMatchdays []models.MatchdayPowerups
			for _, md := range data.Matchdays {
				filteredMd := models.MatchdayPowerups{
					MatchdayNumber: md.MatchdayNumber,
				}
				if md.DoubleScorerMatchId > 0 && lockedMatches[md.DoubleScorerMatchId] {
					filteredMd.DoubleScorerMatchId = md.DoubleScorerMatchId
					filteredMd.DoubleScorerId = md.DoubleScorerId
				}
				if md.TripleScoreMatchId > 0 && lockedMatches[md.TripleScoreMatchId] {
					filteredMd.TripleScoreMatchId = md.TripleScoreMatchId
				}
				if md.ReversalMatchId > 0 && lockedMatches[md.ReversalMatchId] {
					filteredMd.ReversalMatchId = md.ReversalMatchId
				}
				filteredMatchdays = append(filteredMatchdays, filteredMd)
			}
			data.Matchdays = filteredMatchdays
		}
	}

	WriteJSON(w, http.StatusOK, data)
}

func (h *APIHandler) HandlePutPowerups(w http.ResponseWriter, r *http.Request) {
	userId := r.PathValue("id")
	if !h.authorizeUser(r, userId) {
		authID, _ := r.Context().Value(userIDKey).(string)
		http.Error(w, fmt.Sprintf("Forbidden: authID='%s', userId='%s'", authID, userId), http.StatusForbidden)
		return
	}
	compId := r.PathValue("compId")

	var req models.PowerupsData
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	data, err := h.Service.PutPowerups(r.Context(), userId, compId, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, data)
}

func (h *APIHandler) HandleGetScoringSystem(w http.ResponseWriter, r *http.Request) {
	system, err := h.Service.GetScoringSystem(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, system)
}

func (h *APIHandler) HandleGetTeamDetails(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid team ID", http.StatusBadRequest)
		return
	}
	team, err := h.Service.GetTeamDetails(r.Context(), id, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, team)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		lowerOrigin := strings.ToLower(origin)
		isAllowed := lowerOrigin == "https://predict-ball.eu" || lowerOrigin == "https://www.predict-ball.eu" || lowerOrigin == "http://localhost:4200"

		if isAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With, Accept-Encoding, X-CSRF-Token")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests, which are sent by the browser before the actual request.
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func RegisterRoutes(mux *http.ServeMux, h *APIHandler) http.Handler {
	mux.HandleFunc("GET /competition/{id}/match-schedule", h.HandleGetMatchSchedule)
	mux.HandleFunc("GET /match-details/{id}", h.HandleGetMatchDetails)
	mux.HandleFunc("GET /competition/{compId}/match/{matchId}", h.HandleGetMatch)

	mux.HandleFunc("GET /competitions", h.HandleGetCompetitions)
	mux.HandleFunc("GET /competition/{id}", h.HandleGetCompetition)

	mux.HandleFunc("GET /user/{id}", h.HandleGetUser)
	mux.HandleFunc("GET /user/{id}/leagues", h.HandleGetUserLeagues)
	mux.HandleFunc("PUT /user", h.HandlePutUser)
	mux.HandleFunc("PUT /user/{id}/password", h.HandleChangePassword)
	mux.HandleFunc("PUT /user/{id}/display-name", h.HandleUpdateDisplayName)
	mux.HandleFunc("POST /user/{id}/delete", h.HandleDeleteUser)
	mux.HandleFunc("POST /user/authenticate", h.HandleAuthenticateUser)
	mux.HandleFunc("POST /user/logout", h.HandleLogout)

	mux.HandleFunc("GET /competition/{compId}/league/{leagueId}", h.HandleGetPredictionLeague)
	mux.HandleFunc("PUT /competition/{compId}/league", h.HandlePutPredictionLeague)
	mux.HandleFunc("GET /competition/{id}/get-leagues", h.HandleGetCompetitionLeagues)
	mux.HandleFunc("PUT /competition/{id}/join-by-code", h.HandleJoinLeagueByCode)
	mux.HandleFunc("PUT /join/{id}", h.HandleJoinGlobalLeague)

	mux.HandleFunc("POST /user/{id}/competition/{compId}/predictions", h.HandleGetPredictions)
	mux.HandleFunc("PUT /user/{id}/competition/{compId}/prediction/{matchId}", h.HandlePutPrediction)

	mux.HandleFunc("GET /user/{id}/competition/{compId}/powerups", h.HandleGetPowerups)
	mux.HandleFunc("PUT /user/{id}/competition/{compId}/powerups", h.HandlePutPowerups)

	mux.HandleFunc("GET /scoring-system", h.HandleGetScoringSystem)
	mux.HandleFunc("GET /team-details/{id}", h.HandleGetTeamDetails)

	mux.HandleFunc("POST /admin/competition/{compId}/season/{season}/retire", h.HandleRetireSeason)
	mux.HandleFunc("POST /admin/competition/{compId}/retire-season", h.HandleRetireSeason)

	return corsMiddleware(h.AuthMiddleware(mux))
}
