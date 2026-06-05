package handlers

import (
	"encoding/json"
	"net/http"
	"predictball_api/models"
	"predictball_api/services"
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
	schedule, err := h.Service.GetMatchSchedule(r.Context())
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

func (h *APIHandler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := h.Service.GetUser(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, user)
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
	id := r.PathValue("id")
	league, err := h.Service.GetPredictionLeague(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, league)
}

func (h *APIHandler) HandlePutPredictionLeague(w http.ResponseWriter, r *http.Request) {
	var league models.PredictionLeague
	if err := json.NewDecoder(r.Body).Decode(&league); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	created, err := h.Service.PutPredictionLeague(r.Context(), league)
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

func (h *APIHandler) HandleGetTeamSquad(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	squad, err := h.Service.GetTeamSquad(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, squad)
}

func RegisterRoutes(mux *http.ServeMux, h *APIHandler) {
	mux.HandleFunc("GET /match-schedule", h.HandleGetMatchSchedule)
	mux.HandleFunc("GET /match-details/{id}", h.HandleGetMatchDetails)

	mux.HandleFunc("GET /user/{id}", h.HandleGetUser)
	mux.HandleFunc("PUT /user", h.HandlePutUser)

	mux.HandleFunc("GET /prediction-league/{id}", h.HandleGetPredictionLeague)
	mux.HandleFunc("PUT /prediction-league", h.HandlePutPredictionLeague)

	mux.HandleFunc("GET /prediction/{id}", h.HandleGetPrediction)
	mux.HandleFunc("PUT /prediction", h.HandlePutPrediction)
	mux.HandleFunc("PATCH /prediction/{id}", h.HandleUpdatePrediction)

	mux.HandleFunc("GET /scoring-system", h.HandleGetScoringSystem)
	mux.HandleFunc("GET /team-squad/{id}", h.HandleGetTeamSquad)
}
