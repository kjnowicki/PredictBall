import { Area } from "./area";
import { Competition } from "./competition";
import { Person } from "./person";

export interface Team {
	area: Area;
	id: number;
	name: string;
	shortName: string;
	tla: string;
	crest: string;
	address: string;
	website: string;
	founded: number;
	clubColors: string;
	venue: string;
	runningCompetitions: Competition[];
	coach: Person;
	marketValue: number;
	squad: Person[];
	staff: Person[];
	lastUpdated: string;
}