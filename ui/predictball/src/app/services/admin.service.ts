import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';

export interface AdminCompetition {
  id: number;
  name: string;
  code: string;
  type?: string;
  emblem?: string;
  currentSeason?: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner?: any;
    stages?: string[];
    isRetired?: boolean;
    isFinished?: boolean;
  };
  seasons?: Array<{
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
    winner?: any;
    stages?: string[];
    isRetired?: boolean;
    isFinished?: boolean;
  }>;
  area?: {
    id: number;
    name: string;
    code: string;
    flag?: string;
  };
}

export interface EndpointStat {
  endpoint: string;
  totalCount: number;
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
}

export interface ErrorLogEntry {
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode: number;
  userId?: string;
  error: string;
}

export interface StatsSummary {
  totalHttpRequests: number;
  apiTotalRequests: number;
  apiCacheHits: number;
  apiCacheMisses: number;
  apiCacheHitRate: number;
  apiEndpointStats: Record<string, EndpointStat>;
  httpEndpointStats: Record<string, EndpointStat>;
  recentErrors: ErrorLogEntry[];
}

export interface AdminUserDetail {
  id: number;
  username: string;
  displayName: string;
  nameLastChanged: string;
  lastLoggedIn: string;
  visitCount: number;
  uniquePredictions: number;
  totalPredictions: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private api = inject(ApiService);
  private tokenKey = 'adminToken';
  private usernameKey = 'adminUsername';

  login(username: string, password: string): Observable<{ token: string; username: string }> {
    return this.api.post<{ token: string; username: string }>('admin/login', { username, password }).pipe(
      tap(res => {
        if (res && res.token) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.tokenKey, res.token);
            localStorage.setItem(this.usernameKey, res.username);
          }
        }
      })
    );
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.usernameKey);
    }
  }

  getToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  getUsername(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.usernameKey);
    }
    return null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Competitions View API
  getSupportedCompetitions(): Observable<AdminCompetition[]> {
    return this.api.get<AdminCompetition[]>('competitions');
  }

  getAvailableCompetitions(): Observable<AdminCompetition[]> {
    return this.api.get<AdminCompetition[]>('admin/available-competitions');
  }

  addCompetition(id: string | number): Observable<AdminCompetition> {
    return this.api.post<AdminCompetition>('admin/competition/add', { id: String(id) });
  }

  getCompetitionDetail(compId: string | number): Observable<AdminCompetition> {
    return this.api.get<AdminCompetition>(`admin/competition/${compId}`);
  }

  retireSeason(compId: string | number, season: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`admin/competition/${compId}/season/${season}/retire`, {});
  }

  deleteCompetition(compId: string | number): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`admin/competition/${compId}/delete`, {});
  }

  // Stats View API
  getStats(): Observable<StatsSummary> {
    return this.api.get<StatsSummary>('admin/stats');
  }

  // User Management API
  getUsers(): Observable<AdminUserDetail[]> {
    return this.api.get<AdminUserDetail[]>('admin/users');
  }

  deleteUser(userId: number | string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`admin/user/${userId}/delete`, {});
  }

  updateDisplayName(userId: number | string, displayName: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`admin/user/${userId}/display-name`, { displayName });
  }
}
