package handlers

import (
	"encoding/json"
	"net/http"
	"predictball_api/models"
	"predictball_api/services"
	"strconv"
)

type APIHandler struct {
	Service services.APIService
}

func NewAPIHandler(svc services.APIService) *APIHandler {
	return &APIHandler{Service: svc}
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *APIHandler) HandleGetMatchSchedule(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	schedule, err := h.Service.GetMatchSchedule(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, schedule)
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
	WriteJSON(w, http.StatusOK, created)
}

func (h *APIHandler) HandleGetPredictionLeague(w http.ResponseWriter, r *http.Request) {
	compId := r.PathValue("compId")
	leagueId := r.PathValue("leagueId")
	league, err := h.Service.GetPredictionLeague(r.Context(), compId, leagueId)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, league)
}

func (h *APIHandler) HandlePutPredictionLeague(w http.ResponseWriter, r *http.Request) {
	compId := r.PathValue("compId")
	var league models.PredictionLeague
	if err := json.NewDecoder(r.Body).Decode(&league); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	created, err := h.Service.PutPredictionLeague(r.Context(), compId, league)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, created)
}

func (h *APIHandler) HandleGetPrediction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	pred, err := h.Service.GetPrediction(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, pred)
}

func (h *APIHandler) HandlePutPrediction(w http.ResponseWriter, r *http.Request) {
	var pred models.Prediction
	if err := json.NewDecoder(r.Body).Decode(&pred); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	created, err := h.Service.PutPrediction(r.Context(), pred)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, created)
}

func (h *APIHandler) HandleUpdatePrediction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var pred models.Prediction
	if err := json.NewDecoder(r.Body).Decode(&pred); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	updated, err := h.Service.UpdatePrediction(r.Context(), id, pred)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, updated)
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
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:4200")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests, which are sent by the browser before the actual request.
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func RegisterRoutes(mux *http.ServeMux, h *APIHandler) http.Handler {
	mux.HandleFunc("GET /competition/{id}/match-schedule", h.HandleGetMatchSchedule)
	mux.HandleFunc("GET /match-details/{id}", h.HandleGetMatchDetails)

	mux.HandleFunc("GET /competitions", h.HandleGetCompetitions)
	mux.HandleFunc("GET /competition/{id}", h.HandleGetCompetition)

	mux.HandleFunc("GET /user/{id}", h.HandleGetUser)
	mux.HandleFunc("GET /user/{id}/leagues", h.HandleGetUserLeagues)
	mux.HandleFunc("PUT /user", h.HandlePutUser)
	mux.HandleFunc("POST /user/authenticate", h.HandleAuthenticateUser)

	mux.HandleFunc("GET /competition/{compId}/league/{leagueId}", h.HandleGetPredictionLeague)
	mux.HandleFunc("PUT /competition/{compId}/league", h.HandlePutPredictionLeague)
	mux.HandleFunc("PUT /join/{id}", h.HandleJoinGlobalLeague)

	mux.HandleFunc("GET /prediction/{id}", h.HandleGetPrediction)
	mux.HandleFunc("PUT /prediction", h.HandlePutPrediction)
	mux.HandleFunc("PATCH /prediction/{id}", h.HandleUpdatePrediction)

	mux.HandleFunc("GET /scoring-system", h.HandleGetScoringSystem)
	mux.HandleFunc("GET /team-details/{id}", h.HandleGetTeamDetails)

	return corsMiddleware(mux)
}
