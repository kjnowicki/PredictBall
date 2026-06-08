import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ScoringSystem } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ScoringSystemService {
  private api = inject(ApiService);

  getScoringSystem(): Observable<ScoringSystem> {
    return this.api.get<ScoringSystem>('scoring-system');
  }
}