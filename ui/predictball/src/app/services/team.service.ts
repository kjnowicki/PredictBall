import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Team } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private api = inject(ApiService);

  getTeamDetails(teamId: number, params?: Record<string, string | number | boolean>): Observable<Team> {
    return this.api.get<Team>(`teams/${teamId}`, params);
  }
}