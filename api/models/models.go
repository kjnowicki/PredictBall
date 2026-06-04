package models

import "time"

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type Match struct {
	ID        string    `json:"id"`
	HomeTeam  string    `json:"homeTeam"`
	AwayTeam  string    `json:"awayTeam"`
	StartTime time.Time `json:"startTime"`
	Status    string    `json:"status"` // SCHEDULED, IN_PLAY, FINISHED
}

type MatchDetails struct {
	Match
	HomeScore int `json:"homeScore"`
	AwayScore int `json:"awayScore"`
}

type PredictionLeague struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Prediction struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	MatchID   string `json:"matchId"`
	HomeScore int    `json:"homeScore"`
	AwayScore int    `json:"awayScore"`
}

type ScoringSystem struct {
	ID               string `json:"id"`
	ExactScorePoints int    `json:"exactScorePoints"`
	ResultPoints     int    `json:"resultPoints"`
}

type Player struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
}

type TeamSquad struct {
	TeamID  string   `json:"teamId"`
	Players []Player `json:"players"`
}
