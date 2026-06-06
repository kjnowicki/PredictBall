import { Team } from "./team";

export interface Contract {
	start: string;
	until: string;
}

export interface Person {
	id: number;
	name: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string;
	nationality: string;
	position: string;
	shirtNumber: number;
	lastUpdated: string;
	currentTeam: Team;
}