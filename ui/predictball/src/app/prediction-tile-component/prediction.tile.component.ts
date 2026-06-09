import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Match } from '../models';
import { TeamService } from '../services/team.service';
import { forkJoin } from 'rxjs';

interface ScorerOption {
  id: number;
  name: string;
  displayName: string;
}

@Component({
  selector: 'app-prediction-tile',
  imports: [
    CommonModule,
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
export class PredictionTileComponent implements OnInit {
  @Input() match!: Match;

  private teamService = inject(TeamService);
  private cdr = inject(ChangeDetectorRef);

  homeTeam: string = 'Home';
  awayTeam: string = 'Away';
  homeGoalsPrediction: number | null = null;
  awayGoalsPrediction: number | null = null;
  scorers: ScorerOption[] = [];
  selectedScorer: number | null = null;
  scoredPoints: number | null = null;

  isPast: boolean = false;
  isLive: boolean = false;

  ngOnInit() {
    if (this.match) {
      this.checkStatus();
      this.loadData();
    }
  }

  checkStatus() {
    const start = new Date(this.match.startTime);
    this.isPast = start.getTime() < Date.now();
    this.isLive = this.match.status === 'IN_PLAY' || this.match.status === 'PAUSED';
  }

  loadData() {
    forkJoin({
      home: this.teamService.getTeamDetails(this.match.homeTeamId),
      away: this.teamService.getTeamDetails(this.match.awayTeamId)
    }).subscribe(({ home, away }) => {
      this.homeTeam = home.tla || home.shortName || home.name || 'Home';
      this.awayTeam = away.tla || away.shortName || away.name || 'Away';

      const homePlayers = this.match.matchDetails?.homeLineup?.players?.length 
        ? this.match.matchDetails.homeLineup.players 
        : (home.squad || []);
      const awayPlayers = this.match.matchDetails?.awayLineup?.players?.length 
        ? this.match.matchDetails.awayLineup.players 
        : (away.squad || []);

      const mapScorer = (p: any): ScorerOption => {
        const nat = p.nationality || 'UNK';
        const code = nat.length >= 3 ? nat.substring(0, 3).toUpperCase() : nat.toUpperCase();
        return { id: p.id, name: p.name, displayName: `[${code}] ${p.name}` };
      };

      this.scorers = [...homePlayers, ...awayPlayers]
        .map(mapScorer)
        .sort((a, b) => a.name.localeCompare(b.name));

      this.cdr.detectChanges();
    });
  }
}
