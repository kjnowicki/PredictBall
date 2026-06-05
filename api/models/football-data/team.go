package footballdata

type Team struct {
	Area                Area          `json:"area"`
	ID                  int           `json:"id"`
	Name                string        `json:"name"`
	ShortName           string        `json:"shortName"`
	Tla                 string        `json:"tla"`
	Crest               string        `json:"crest"`
	Address             string        `json:"address"`
	Website             string        `json:"website"`
	Founded             int           `json:"founded"`
	ClubColors          string        `json:"clubColors"`
	Venue               string        `json:"venue"`
	RunningCompetitions []Competition `json:"runningCompetitions"`
	Coach               Person        `json:"coach"`
	MarketValue         int           `json:"marketValue"`
	Squad               []Person      `json:"squad"`
	Staff               []Person      `json:"staff"`
	LastUpdated         string        `json:"lastUpdated"`
}
