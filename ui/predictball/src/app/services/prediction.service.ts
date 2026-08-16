import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Prediction } from '../models';

@Injectable({
  providedIn: 'root'
})
export class PredictionService {
  private api = inject(ApiService);

  getPrediction(predictionId: string): Observable<Prediction> {
    return this.api.get<Prediction>(`prediction/${predictionId}`);
  }

  savePrediction(userId: string, compId: string, matchId: number, prediction: any): Observable<any> {
    return this.api.put<any>(`user/${userId}/competition/${compId}/prediction/${matchId}`, prediction);
  }
}