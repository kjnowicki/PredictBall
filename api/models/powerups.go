package models

type MatchdayPowerups struct {
	MatchdayNumber      int `json:"matchdayNumber"`
	DoubleScorerMatchId int `json:"doubleScorerMatchId"`
	TripleScorerMatchId int `json:"tripleScorerMatchId"`
	ReversalMatchId     int `json:"reversalMatchId"`
}

type PowerupsData struct {
	Season    string             `json:"season"`
	Matchdays []MatchdayPowerups `json:"matchdays"`
}
