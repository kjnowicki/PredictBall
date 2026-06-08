import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Competition } from '../models/competition';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private api = inject(ApiService);

  getCompetition(competitionId: number): Observable<Competition> {
    return this.api.get<Competition>(`competition/${competitionId}`);
  }

  getAllCompetitions(): Observable<Competition[]> {
    return this.api.get<Competition[]>('competitions');
  }
}