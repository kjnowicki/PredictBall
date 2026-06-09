import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Competition } from '../models/competition';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private api = inject(ApiService);

  getCompetition(competitionCode: string): Observable<Competition> {
    return this.api.get<Competition>(`competition/${competitionCode}`);
  }

  getAllCompetitions(): Observable<Competition[]> {
    return this.api.get<Competition[]>('competitions');
  }

  getPredictions(userId: string, compId: string, matchIds: number[]): Observable<any[]> {
    return this.api.post<any[]>(`user/${userId}/competition/${compId}/predictions`, { matchIds });
  }

  savePrediction(userId: string, compId: string, matchId: number, prediction: any): Observable<any> {
    return this.api.put<any>(`user/${userId}/competition/${compId}/prediction/${matchId}`, prediction);
  }
}