package footballdata

type Contract struct {
	Start string `json:"start"`
	Until string `json:"until"`
}

type Person struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	DateOfBirth string `json:"dateOfBirth"`
	Nationality string `json:"nationality"`
	Position    string `json:"position"`
	ShirtNumber int    `json:"shirtNumber"`
	LastUpdated string `json:"lastUpdated"`
	CurrentTeam *Team  `json:"currentTeam,omitempty"`
}
