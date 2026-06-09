import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Match } from '../models';
import { TeamService } from '../services/team.service';
import { Team } from '../models/team';
import { forkJoin } from 'rxjs';

interface ScorerOption {
  id: number;
  name: string;
  code: string;
  teamName: string;
}

interface ScorerGroup {
  name: string;
  scorers: ScorerOption[];
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
export class PredictionTileComponent implements OnInit, OnChanges {
  @Input() match!: Match;
  @Input() prediction?: any;
  @Input() availablePowerups?: any;
  @Input() scoringSystem?: any;
  @Output() predictionChanged = new EventEmitter<any>();

  private teamService = inject(TeamService);
  private cdr = inject(ChangeDetectorRef);

  homeTeam?: Team;
  awayTeam?: Team;
  homeGoalsPrediction: number | null = null;
  awayGoalsPrediction: number | null = null;
  scorerGroups: ScorerGroup[] = [];
  selectedScorer: number | null = null;
  scoredPoints: number | null = null;
  activePowerup: string | null = null;
  secondScorer: number | null = null;

  isPast: boolean = false;
  isLive: boolean = false;
  isSelectOpen: boolean = false;
  private saveTimeout: any;

  ngOnInit() {
    if (this.match) {
      this.checkStatus();
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prediction'] && this.prediction) {
      this.homeGoalsPrediction = this.prediction.homeScore;
      this.awayGoalsPrediction = this.prediction.awayScore;
      this.selectedScorer = this.prediction.scorerId === 0 ? null : this.prediction.scorerId;
      this.activePowerup = this.prediction.powerup || null;
    }
    if (changes['availablePowerups'] && this.availablePowerups) {
      if (this.availablePowerups.doubleScorerMatchId === this.match.id) {
        this.secondScorer = this.availablePowerups.doubleScorerId === 0 ? null : this.availablePowerups.doubleScorerId;
      }
    }
    if (changes['scoringSystem'] || changes['prediction'] || changes['availablePowerups'] || changes['match']) {
      this.calculatePoints();
    }
  }

  checkStatus() {
    const start = new Date(this.match.startTime);
    this.isPast = start.getTime() < Date.now();
    this.isLive = this.match.status === 'IN_PLAY' || this.match.status === 'PAUSED';
  }

  onSelectOpened(isOpen: boolean) {
    this.isSelectOpen = isOpen;
    if (isOpen) {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
    } else {
      this.onPredictionInput();
    }
  }

  togglePowerup(powerup: string) {
    if (this.isPast) return;

    if (this.activePowerup !== powerup) {
      if (powerup === 'doubleScorer' && this.availablePowerups?.doubleScorerMatchId && this.availablePowerups.doubleScorerMatchId !== this.match.id) return;
      if (powerup === 'tripleScore' && this.availablePowerups?.tripleScoreMatchId && this.availablePowerups.tripleScoreMatchId !== this.match.id) return;
      if (powerup === 'reversal') {
        if (this.availablePowerups?.reversalMatchId && this.availablePowerups.reversalMatchId !== this.match.id) return;
        if (this.homeGoalsPrediction !== null && this.awayGoalsPrediction !== null && this.homeGoalsPrediction === this.awayGoalsPrediction) return;
      }
    }

    if (this.homeGoalsPrediction === null) this.homeGoalsPrediction = 0;
    if (this.awayGoalsPrediction === null) this.awayGoalsPrediction = 0;

    if (this.activePowerup === powerup) {
      this.activePowerup = null;
    } else {
      this.activePowerup = powerup;
    }

    this.onPredictionInput();
    this.calculatePoints();
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.emitPrediction();
  }

  onPredictionInput() {
    if (this.isPast || this.isSelectOpen) return;

    if (this.activePowerup === 'reversal' && this.homeGoalsPrediction !== null && this.awayGoalsPrediction !== null && this.homeGoalsPrediction === this.awayGoalsPrediction) {
      this.activePowerup = null;
    }

    this.calculatePoints();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.emitPrediction();
    }, 1000);
  }

  emitPrediction() {
    if (this.homeGoalsPrediction !== null && this.awayGoalsPrediction !== null) {
      this.predictionChanged.emit({
        homeScore: this.homeGoalsPrediction,
        awayScore: this.awayGoalsPrediction,
        scorerId: this.selectedScorer || 0,
        powerup: this.activePowerup,
        doubleScorerId: this.secondScorer || 0
      });
    }
  }

  calculatePoints() {
    if (!this.scoringSystem || !this.match || !this.match.matchDetails || this.match.status !== 'FINISHED' || this.homeGoalsPrediction === null || this.awayGoalsPrediction === null) {
      this.scoredPoints = null;
      return;
    }

    const actualHome = this.match.matchDetails.homeScore;
    const actualAway = this.match.matchDetails.awayScore;
    let predHome = this.homeGoalsPrediction;
    let predAway = this.awayGoalsPrediction;

    if (this.activePowerup === 'reversal' && actualHome !== actualAway) {
        const actualDiff = actualHome - actualAway;
        const predDiff = predHome - predAway;
        if ((actualDiff > 0 && predDiff < 0) || (actualDiff < 0 && predDiff > 0)) {
            const temp = predHome;
            predHome = predAway;
            predAway = temp;
        }
    }

    let points = 0;
    if (actualHome === predHome && actualAway === predAway) {
      points += this.scoringSystem.scoreExact;
    } else {
      if (actualHome === predHome) points += this.scoringSystem.scoreHomeExact;
      if (actualAway === predAway) points += this.scoringSystem.scoreAwayExact;
      if (actualHome - actualAway === predHome - predAway) {
        points += this.scoringSystem.scoreDif;
      }
    }

    const actualScorers = this.match.matchDetails.scorers?.map((s: any) => s.id) || [];
    let scorerPoints = 0;
    if (this.selectedScorer && actualScorers.includes(this.selectedScorer)) scorerPoints += this.scoringSystem.scorer;
    if (this.activePowerup === 'doubleScorer' && this.secondScorer && actualScorers.includes(this.secondScorer)) scorerPoints += this.scoringSystem.scorer;

    points += scorerPoints;
    if (this.activePowerup === 'tripleScore') points *= 3;

    this.scoredPoints = points;
  }

  loadData() {
    forkJoin({
      home: this.teamService.getTeamDetails(this.match.homeTeamId),
      away: this.teamService.getTeamDetails(this.match.awayTeamId)
    }).subscribe(({ home, away }) => {
      this.homeTeam = home;
      this.awayTeam = away;

      const homePlayers = this.match.matchDetails?.homeLineup?.players?.length 
        ? this.match.matchDetails.homeLineup.players 
        : (home.squad || []);
      const awayPlayers = this.match.matchDetails?.awayLineup?.players?.length 
        ? this.match.matchDetails.awayLineup.players 
        : (away.squad || []);

      const groupsMap = new Map<string, ScorerGroup>();

      const addPlayersToGroup = (players: any[], teamName: string, teamCode: string) => {
        if (!groupsMap.has(teamName)) {
          groupsMap.set(teamName, { name: teamName, scorers: [] });
        }
        players.forEach((p: any) => {
          groupsMap.get(teamName)!.scorers.push({
            id: p.id,
            name: p.name,
            code: teamCode,
            teamName: teamName
          });
        });
      };

      const homeName = home.name || 'Home';
      const awayName = away.name || 'Away';
      const homeCode = home.tla || home.shortName || homeName;
      const awayCode = away.tla || away.shortName || awayName;

      addPlayersToGroup(homePlayers, homeName, homeCode);
      addPlayersToGroup(awayPlayers, awayName, awayCode);

      this.scorerGroups = Array.from(groupsMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      this.scorerGroups.forEach(group => {
        group.scorers.sort((a, b) => a.name.localeCompare(b.name));
      });

      this.cdr.detectChanges();
    });
  }

  getFlagEmoji(teamName: string): string {
    const flags: Record<string, string> = {
      'Argentina': '🇦🇷', 'Australia': '🇦🇺', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
      'Brazil': '🇧🇷', 'Cameroon': '🇨🇲', 'Canada': '🇨🇦', 'Colombia': '🇨🇴',
      'Costa Rica': '🇨🇷', 'Croatia': '🇭🇷', 'Czech Republic': '🇨🇿', 'Denmark': '🇩🇰',
      'Ecuador': '🇪🇨', 'Egypt': '🇪🇬', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France': '🇫🇷',
      'Germany': '🇩🇪', 'Ghana': '🇬🇭', 'Iran': '🇮🇷', 'Italy': '🇮🇹',
      'Ivory Coast': '🇨🇮', 'Japan': '🇯🇵', 'Mexico': '🇲🇽', 'Morocco': '🇲🇦',
      'Netherlands': '🇳🇱', 'Nigeria': '🇳🇬', 'Norway': '🇳🇴', 'Poland': '🇵🇱',
      'Portugal': '🇵🇹', 'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      'Senegal': '🇸🇳', 'Serbia': '🇷🇸', 'South Korea': '🇰🇷', 'Spain': '🇪🇸',
      'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Tunisia': '🇹🇳', 'United States': '🇺🇸',
      'USA': '🇺🇸', 'Uruguay': '🇺🇾', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
    };
    return flags[teamName] || '🏳️';
  }
}
