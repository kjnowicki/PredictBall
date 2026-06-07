import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-prediction-tile',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './prediction.tile.component.html',
  styleUrl: './prediction.tile.component.css',
})
export class PredictionTileComponent {
  @Input() matchId!: string;

  homeTeam: string = 'Home Team';
  awayTeam: string = 'Away Team';
  homeGoalsPrediction: number | null = null;
  awayGoalsPrediction: number | null = null;
  scorers: string[] = ['Player 1', 'Player 2', 'Player 3'];
  selectedScorer: string | null = null;
  scoredPoints: number | null = null;
}
