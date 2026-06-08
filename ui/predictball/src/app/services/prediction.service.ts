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

  createPrediction(prediction: Prediction): Observable<Prediction> {
    return this.api.put<Prediction>('prediction', prediction);
  }

  updatePrediction(predictionId: string, prediction: Prediction): Observable<Prediction> {
    return this.api.patch<Prediction>(`prediction/${predictionId}`, prediction);
  }
}