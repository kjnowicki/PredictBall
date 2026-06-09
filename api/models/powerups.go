package models

type MatchdayPowerups struct {
	MatchdayNumber      int `json:"matchdayNumber"`
	DoubleScorerMatchId int `json:"doubleScorerMatchId"`
	DoubleScorerId      int `json:"doubleScorerId"`
	TripleScoreMatchId  int `json:"tripleScoreMatchId"`
	ReversalMatchId     int `json:"reversalMatchId"`
}

type PowerupsData struct {
	Season    string             `json:"season"`
	Matchdays []MatchdayPowerups `json:"matchdays"`
}
