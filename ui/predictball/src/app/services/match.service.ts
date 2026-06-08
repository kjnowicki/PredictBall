import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { MatchesResponse, MatchDetails } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private api = inject(ApiService);

  getMatches(params?: Record<string, string | number | boolean>): Observable<MatchesResponse> {
    return this.api.get<MatchesResponse>('matches', params);
  }

  getMatchDetails(matchId: string): Observable<MatchDetails> {
    return this.api.get<MatchDetails>(`matches/${matchId}/details`);
  }
}