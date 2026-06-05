package footballdata

type Season struct {
	ID              int      `json:"id"`
	StartDate       string   `json:"startDate"`
	EndDate         string   `json:"endDate"`
	CurrentMatchday int      `json:"currentMatchday"`
	Winner          any      `json:"winner,omitempty"`
	Stages          []string `json:"stages"`
}

type Coach struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Nationality string `json:"nationality"`
}

type SquadPlayer struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Position    string `json:"position"`
	ShirtNumber int    `json:"shirtNumber"`
}

type Statistic struct {
	CornerKicks    int `json:"corner_kicks"`
	FreeKicks      int `json:"free_kicks"`
	GoalKicks      int `json:"goal_kicks"`
	Offsides       int `json:"offsides"`
	Fouls          int `json:"fouls"`
	BallPossession int `json:"ball_possession"`
	Saves          int `json:"saves"`
	ThrowIns       int `json:"throw_ins"`
	Shots          int `json:"shots"`
	ShotsOnGoal    int `json:"shots_on_goal"`
	ShotsOffGoal   int `json:"shots_off_goal"`
	YellowCards    int `json:"yellow_cards"`
	YellowRedCards int `json:"yellow_red_cards"`
	RedCards       int `json:"red_cards"`
}

type MatchTeam struct {
	ID         int           `json:"id"`
	Name       string        `json:"name"`
	ShortName  string        `json:"shortName"`
	Tla        string        `json:"tla"`
	Crest      string        `json:"crest"`
	Coach      Coach         `json:"coach"`
	LeagueRank any           `json:"leagueRank,omitempty"`
	Formation  string        `json:"formation"`
	Lineup     []SquadPlayer `json:"lineup"`
	Bench      []SquadPlayer `json:"bench"`
	Statistics Statistic     `json:"statistics"`
}

type TeamScore struct {
	Home *int `json:"home"`
	Away *int `json:"away"`
}

type MatchScore struct {
	Winner   string    `json:"winner"`
	Duration string    `json:"duration"`
	FullTime TeamScore `json:"fullTime"`
	HalfTime TeamScore `json:"halfTime"`
}

type TeamRef struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Scorer struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Goal struct {
	Minute     int       `json:"minute"`
	InjuryTime any       `json:"injuryTime,omitempty"`
	Type       string    `json:"type"`
	Team       TeamRef   `json:"team"`
	Scorer     Scorer    `json:"scorer"`
	Assist     any       `json:"assist,omitempty"`
	Score      TeamScore `json:"score"`
}

type Player struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Penalty struct {
	Player Player  `json:"player"`
	Team   TeamRef `json:"team"`
	Scored bool    `json:"scored"`
}

type Booking struct {
	Minute int     `json:"minute"`
	Team   TeamRef `json:"team"`
	Player Player  `json:"player"`
	Card   string  `json:"card"`
}

type Substitution struct {
	Minute    int     `json:"minute"`
	Team      TeamRef `json:"team"`
	PlayerOut Player  `json:"playerOut"`
	PlayerIn  Player  `json:"playerIn"`
}

type Odd struct {
	HomeWin float64 `json:"homeWin"`
	Draw    float64 `json:"draw"`
	AwayWin float64 `json:"awayWin"`
}

type Referee struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Nationality string `json:"nationality"`
}

type Match struct {
	Area          Area           `json:"area"`
	Competition   Competition    `json:"competition"`
	Season        Season         `json:"season"`
	ID            int            `json:"id"`
	UtcDate       string         `json:"utcDate"`
	Status        string         `json:"status"`
	Minute        int            `json:"minute"`
	InjuryTime    int            `json:"injuryTime"`
	Attendance    int            `json:"attendance"`
	Venue         string         `json:"venue"`
	Matchday      int            `json:"matchday"`
	Stage         string         `json:"stage"`
	Group         any            `json:"group,omitempty"`
	LastUpdated   string         `json:"lastUpdated"`
	HomeTeam      MatchTeam      `json:"homeTeam"`
	AwayTeam      MatchTeam      `json:"awayTeam"`
	Score         MatchScore     `json:"score"`
	Goals         []Goal         `json:"goals"`
	Penalties     []Penalty      `json:"penalties"`
	Bookings      []Booking      `json:"bookings"`
	Substitutions []Substitution `json:"substitutions"`
	Odds          Odd            `json:"odds"`
	Referees      []Referee      `json:"referees"`
}
