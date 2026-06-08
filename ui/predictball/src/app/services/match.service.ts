import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Match, MatchDetails } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private api = inject(ApiService);

  getMatchSchedule(): Observable<Match[]> {
    return this.api.get<Match[]>('match-schedule');
  }

  getMatchDetails(matchId: string): Observable<MatchDetails> {
    return this.api.get<MatchDetails>(`match-details/${matchId}`);
  }
}