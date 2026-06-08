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
}