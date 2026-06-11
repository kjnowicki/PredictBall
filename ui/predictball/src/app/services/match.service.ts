import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Match, MatchDetails } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private api = inject(ApiService);

  getMatchSchedule(competitionCode: string): Observable<Match[]> {
    return this.api.get<Match[]>(`competition/${competitionCode}/match-schedule`);
  }

  getMatchDetails(matchId: string): Observable<MatchDetails> {
    return this.api.get<MatchDetails>(`match-details/${matchId}`);
  }

  getMatch(competitionCode: string, matchId: string): Observable<Match> {
    return this.api.get<Match>(`competition/${competitionCode}/match/${matchId}`);
  }
}