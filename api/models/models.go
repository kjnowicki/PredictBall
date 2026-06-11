package models

import "time"

type User struct {
	ID              int       `json:"id"`
	Username        string    `json:"username,omitempty"`
	Password        string    `json:"password,omitempty"`
	DisplayName     string    `json:"displayName"`
	NameLastChanged time.Time `json:"nameLastChanged"`
}

type Match struct {
	ID           int         `json:"id"`
	Matchday     int         `json:"matchday"`
	HomeTeamID   int         `json:"homeTeamId"`
	AwayTeamID   int         `json:"awayTeamId"`
	StartTime    time.Time   `json:"startTime"`
	Status       MatchStatus `json:"status"`
	MatchDetails `json:"matchDetails"`
}

type MatchStatus string

const (
	StatusScheduled    MatchStatus = "SCHEDULED"
	StatusLive         MatchStatus = "LIVE"
	StatusFinished     MatchStatus = "FINISHED"
	StatusLineupsReady MatchStatus = "LINEUPS-READY"
)

type MatchDetails struct {
	HomeScore  int       `json:"homeScore"`
	HomeLineup TeamSquad `json:"homeLineup"`
	AwayScore  int       `json:"awayScore"`
	AwayLineup TeamSquad `json:"awayLineup"`
	Scorers    []Player  `json:"scorers"`
}

type PredictionLeague struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	JoinCode string `json:"joinCode"`
	Public   bool   `json:"public"`
	UserIDs  []int  `json:"userIds,omitempty"`
}

type UserCompetitionLeagues struct {
	CompetitionID int   `json:"competitionId"`
	LeagueIDs     []int `json:"leagueIds"`
}

type LeagueUser struct {
	UserID int    `json:"userId"`
	Name   string `json:"name"`
	Points int    `json:"points"`
}

type GlobalLeague struct {
	PredictionLeague
	Users []LeagueUser `json:"users"`
}

type UserLeagues struct {
	UserID       int                      `json:"userId"`
	Competitions []UserCompetitionLeagues `json:"competitions"`
}

type Prediction struct {
	ID        int `json:"id"`
	UserID    int `json:"userId"`
	MatchID   int `json:"matchId"`
	HomeScore int `json:"homeScore"`
	AwayScore int `json:"awayScore"`
	ScorerID  int `json:"scorerId"`
}

type ScoringSystem struct {
	ScoreDif       int `json:"scoreDif"`
	ScoreExact     int `json:"scoreExact"`
	ScoreHomeExact int `json:"scoreHomeExact"`
	ScoreAwayExact int `json:"scoreAwayExact"`
	Scorer         int `json:"scorer"`
	Result         int `json:"result"`
	BothScorers    int `json:"bothScorers"`
}

type Player struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Position string `json:"position"`
}

type TeamSquad struct {
	TeamID  int      `json:"teamId"`
	Players []Player `json:"players"`
}

type TeamDetails struct {
	TeamID int    `json:"teamId"`
	Name   string `string:"teamName"`
	Crest  string `string:"crestUrl"`
}
