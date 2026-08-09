package footballdata

type Competition struct {
	ID            int      `json:"id"`
	Name          string   `json:"name"`
	Code          string   `json:"code"`
	Type          string   `json:"type"`
	Emblem        string   `json:"emblem"`
	CurrentSeason Season   `json:"currentSeason"`
	Seasons       []Season `json:"seasons,omitempty"`
	Area          Area     `json:"area,omitempty"`
}
