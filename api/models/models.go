package models

import "time"

type User struct {
	ID                    int             `json:"id"`
	Username              string          `json:"username,omitempty"`
	Password              string          `json:"password,omitempty"`
	DisplayName           string          `json:"displayName"`
	NameLastChanged       time.Time       `json:"nameLastChanged"`
	LastLoggedIn          time.Time       `json:"lastLoggedIn,omitempty"`
	VisitCount            int             `json:"visitCount"`
	LeagueViewPreferences map[string]bool `json:"leagueViewPreferences,omitempty"`
}

type AdminUserDetail struct {
	ID                int       `json:"id"`
	Username          string    `json:"username"`
	DisplayName       string    `json:"displayName"`
	NameLastChanged   time.Time `json:"nameLastChanged"`
	LastLoggedIn      time.Time `json:"lastLoggedIn"`
	VisitCount        int       `json:"visitCount"`
	UniquePredictions int       `json:"uniquePredictions"`
	TotalPredictions  int       `json:"totalPredictions"`
}

type EndpointStat struct {
	Endpoint    string `json:"endpoint"`
	TotalCount  int64  `json:"totalCount"`
	CacheHits   int64  `json:"cacheHits"`
	CacheMisses int64  `json:"cacheMisses"`
	ErrorCount  int64  `json:"errorCount"`
}

type ErrorLogEntry struct {
	Timestamp  time.Time `json:"timestamp"`
	Endpoint   string    `json:"endpoint"`
	Method     string    `json:"method"`
	StatusCode int       `json:"statusCode"`
	UserID     string    `json:"userId,omitempty"`
	Error      string    `json:"error"`
}

type StatsSummary struct {
	TotalHTTPRequests int64                    `json:"totalHttpRequests"`
	APITotalRequests  int64                    `json:"apiTotalRequests"`
	APICacheHits      int64                    `json:"apiCacheHits"`
	APICacheMisses    int64                    `json:"apiCacheMisses"`
	APICacheHitRate   float64                  `json:"apiCacheHitRate"`
	APIEndpointStats  map[string]*EndpointStat `json:"apiEndpointStats"`
	HTTPEndpointStats map[string]*EndpointStat `json:"httpEndpointStats"`
	RecentErrors      []ErrorLogEntry          `json:"recentErrors"`
}

type Match struct {
	ID           int         `json:"id"`
	Matchday     int         `json:"matchday"`
	Stage        string      `json:"stage,omitempty"`
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

type Substitution struct {
	Minute    int    `json:"minute"`
	TeamID    int    `json:"teamId"`
	TeamName  string `json:"teamName"`
	PlayerOut Player `json:"playerOut"`
	PlayerIn  Player `json:"playerIn"`
}

type MatchDetails struct {
	HomeScore     int            `json:"homeScore"`
	HomeLineup    TeamSquad      `json:"homeLineup"`
	HomeBench     TeamSquad      `json:"homeBench,omitempty"`
	AwayScore     int            `json:"awayScore"`
	AwayLineup    TeamSquad      `json:"awayLineup"`
	AwayBench     TeamSquad      `json:"awayBench,omitempty"`
	Scorers       []Player       `json:"scorers"`
	Substitutions []Substitution `json:"substitutions,omitempty"`
	LiveHomeScore int            `json:"liveHomeScore"`
	LiveAwayScore int            `json:"liveAwayScore"`
	Duration      string         `json:"duration,omitempty"`
}

type PredictionLeague struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	JoinCode string `json:"joinCode"`
	Public   bool   `json:"public"`
	UserIDs  []int  `json:"userIds,omitempty"`
	IsCasual bool   `json:"isCasual,omitempty"`
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
	Name   string `json:"teamName"`
	Crest  string `json:"crestUrl"`
}
