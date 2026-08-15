import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Match } from '../models';
import { TeamService } from '../services/team.service';
import { MatchService } from '../services/match.service';
import { Team } from '../models/team';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { calculatePredictionPoints } from '../utils/scoring.utils';
import { TeamSelect } from '../team-select/team-select';

interface ScorerOption {
  id: number;
  name: string;
  code: string;
  teamName: string;
  order?: number;
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
    MatDialogModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './prediction.tile.component.html',
  styleUrl: './prediction.tile.component.css',
})
export class PredictionTileComponent implements OnInit, OnChanges, OnDestroy {
  @Input() match!: Match;
  @Input() prediction?: any;
  @Input() availablePowerups?: any;
  @Input() scoringSystem?: any;
  @Input() competition?: any;
  @Input() readOnly: boolean = false;
  @Input() isTripleScoreDisabled: boolean = false;
  @Input() isReversalDisabled: boolean = false;
  @Input() isMatchOfTheWeek: boolean = false;
  @Output() predictionChanged = new EventEmitter<any>();
  @Output() isModifying = new EventEmitter<boolean>();

  private teamService = inject(TeamService);
  private cdr = inject(ChangeDetectorRef);
  private matchService = inject(MatchService);
  private dialog = inject(MatDialog);
  private platformId = inject(PLATFORM_ID);

  homeTeam?: Team;
  awayTeam?: Team;
  homeGoalsPrediction: number | null = null;
  awayGoalsPrediction: number | null = null;
  scorerGroups: ScorerGroup[] = [];
  selectedScorer: number | null = null;
  scoredPoints: number | null = null;
  activePowerup: string | null = null;
  secondScorer: number | null = null;
  pointsBreakdown: string = '';
  timeZoneString: string = '';

  isPast: boolean = false;
  isLive: boolean = false;
  private liveUpdateInterval: any;
  private statusCheckInterval: any;
  private saveTimeout: any;
  private hasUnsavedChanges = false;
  private _isCurrentlyModifying = false;

  get isPredictionDisabled(): boolean {
    return this.isPast || this.readOnly;
  }

  private setModifyingState(isModifying: boolean) {
    if (this._isCurrentlyModifying !== isModifying) {
      this._isCurrentlyModifying = isModifying;
      this.isModifying.emit(isModifying);
    }
  }

  ngOnInit() {
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    this.timeZoneString = offset === 0 ? 'UTC' : `UTC${sign}${hours}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}`;

    if (this.match) {
      this.checkStatus();
      this.loadData();
      this.startStatusTimer();
    }
  }

  ngOnDestroy() {
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
    }
    this.stopStatusTimer();
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      if (this.hasUnsavedChanges) {
        this.emitPrediction();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prediction']) {
      if (this.prediction) {
        if (!this.saveTimeout) {
          this.homeGoalsPrediction = this.prediction.homeScore;
          this.awayGoalsPrediction = this.prediction.awayScore;
          this.selectedScorer = this.prediction.scorerId === 0 ? null : this.prediction.scorerId;
        }
      } else {
        this.homeGoalsPrediction = null;
        this.awayGoalsPrediction = null;
        this.selectedScorer = null;
      }
    }
    if (changes['availablePowerups'] && this.availablePowerups) {
      if (this.availablePowerups.doubleScorerMatchId === this.match.id) {
        this.activePowerup = 'doubleScorer';
        const prev = changes['availablePowerups'].previousValue;
        if (!prev || prev.doubleScorerMatchId !== this.match.id || prev.doubleScorerId !== this.availablePowerups.doubleScorerId) {
          this.secondScorer = this.availablePowerups.doubleScorerId === 0 ? null : this.availablePowerups.doubleScorerId;
        }
      } else if (this.availablePowerups.tripleScoreMatchId === this.match.id && !this.isTripleScoreDisabled) {
        this.activePowerup = 'tripleScore';
      } else if (this.availablePowerups.reversalMatchId === this.match.id && !this.isReversalDisabled) {
        this.activePowerup = 'reversal';
      } else {
        this.activePowerup = null;
      }
    } else if (changes['availablePowerups']) {
      this.activePowerup = null;
      this.secondScorer = null;
    }
    if (changes['scoringSystem'] || changes['prediction'] || changes['availablePowerups'] || changes['match']) {
      this.calculatePoints();
    }
    if (changes['match'] && this.match) {
      this.checkStatus();
      this.startStatusTimer();
    }
  }

  checkStatus() {
    const start = new Date(this.match.startTime);
    this.isLive = this.match.status === 'IN_PLAY' || this.match.status === 'PAUSED' || this.match.status === 'LIVE';
    this.isPast = start.getTime() < Date.now() || (this.match.status !== 'SCHEDULED' && this.match.status !== 'TIMED' && this.match.status !== 'LINEUPS-READY');

    if (this.isPast) {
      this.stopStatusTimer();
    }

    if (isPlatformBrowser(this.platformId)) {
      if (this.isLive && !this.liveUpdateInterval) {
        this.liveUpdateInterval = setInterval(() => {
          this.fetchMatchUpdate();
        }, 60000);
      } else if (!this.isLive && this.liveUpdateInterval) {
        clearInterval(this.liveUpdateInterval);
        this.liveUpdateInterval = null;
      }
    }
  }

  private startStatusTimer() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    if (isPlatformBrowser(this.platformId) && !this.isPast) {
      this.statusCheckInterval = setInterval(() => {
        const wasPast = this.isPast;
        this.checkStatus();
        if (this.isPast !== wasPast) {
          this.cdr.detectChanges();
        }
      }, 5000);
    }
  }

  private stopStatusTimer() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  fetchMatchUpdate() {
    if (this.competition && this.competition.code) {
      this.matchService.getMatch(this.competition.code, this.match.id.toString()).pipe(catchError(() => of(null))).subscribe({
        next: updatedMatch => {
          if (updatedMatch && this.match) {
            this.match.status = updatedMatch.status;
            if (this.match.matchDetails && updatedMatch.matchDetails) {
              this.match.matchDetails.homeScore = updatedMatch.matchDetails.homeScore ?? 0;
              this.match.matchDetails.awayScore = updatedMatch.matchDetails.awayScore ?? 0;
              this.match.matchDetails.scorers = updatedMatch.matchDetails.scorers || [];
            } else {
              this.match.matchDetails = updatedMatch.matchDetails;
            }
          }
          this.checkStatus();
          this.calculatePoints();
          this.cdr.detectChanges();
        },
        error: err => console.error('Error fetching match update:', err)
      });
    } else {
      this.matchService.getMatchDetails(this.match.id.toString()).subscribe({
        next: details => {
          if (this.match) {
            if (this.match.matchDetails && details) {
              this.match.matchDetails.homeScore = details.homeScore ?? 0;
              this.match.matchDetails.awayScore = details.awayScore ?? 0;
              this.match.matchDetails.scorers = details.scorers || [];
            } else {
              this.match.matchDetails = details;
            }
          }
          this.checkStatus();
          this.calculatePoints();
          this.cdr.detectChanges();
        },
        error: err => console.error('Error fetching match details:', err)
      });
    }
  }

  getCardStyle(): any {
    if (this.isLive) {
      return { 'background-color': '#ffe0b2', 'border': '2px solid red' };
    } else if (this.isPast) {
      return { 'background-color': '#81c784', 'border': '2px solid black' };
    }
    return { 'background-color': '#b1ecb6' };
  }

  openTeamSelect(type: 'scorer' | 'secondScorer') {
    if (this.isPredictionDisabled) return;
    if (type === 'secondScorer' && this.activePowerup !== 'doubleScorer') return;
    
    const dialogRef = this.dialog.open(TeamSelect, {
      width: '95vw',
      maxWidth: '1000px',
      maxHeight: '90vh',
      data: {
        competitionCode: this.competition?.code,
        match: this.match,
        homeTeam: this.homeTeam,
        awayTeam: this.awayTeam
      }
    });

    dialogRef.afterClosed().subscribe((playerId: any) => {
      if (playerId !== undefined && playerId !== '') {
        let changed = false;
        const newId = playerId === 0 ? null : Number(playerId);
        if (type === 'scorer') {
          if (this.selectedScorer !== newId) {
            this.selectedScorer = newId;
            changed = true;
          }
        } else {
          if (this.secondScorer !== newId) {
            this.secondScorer = newId;
            changed = true;
          }
        }

        if (changed) {
          this.onPredictionInput();
        }
      }
    });
  }

  get isDrawPrediction(): boolean {
    const h = Number(this.homeGoalsPrediction) || 0;
    const a = Number(this.awayGoalsPrediction) || 0;
    return h === a;
  }

  togglePowerup(powerup: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (this.isPredictionDisabled) return;

    if (this.activePowerup !== powerup) {
      if (powerup === 'doubleScorer' && this.availablePowerups?.doubleScorerMatchId && this.availablePowerups.doubleScorerMatchId !== this.match.id) return;
      if (powerup === 'tripleScore') {
        if (this.isTripleScoreDisabled) return;
        if (this.availablePowerups?.tripleScoreMatchId && this.availablePowerups.tripleScoreMatchId !== this.match.id) return;
      }
      if (powerup === 'reversal') {
        if (this.isReversalDisabled) return;
        if (this.availablePowerups?.reversalMatchId && this.availablePowerups.reversalMatchId !== this.match.id) return;
        if (this.isDrawPrediction) return;
      }
    }

    if (this.homeGoalsPrediction === null) this.homeGoalsPrediction = 0;
    if (this.awayGoalsPrediction === null) this.awayGoalsPrediction = 0;

    if (this.activePowerup === powerup) {
      this.activePowerup = null;
    } else {
      this.activePowerup = powerup;
    }

    this.calculatePoints();

    this.emitPrediction();

    // Manually trigger the modifying state timeout to simulate the saving indicator delay safely
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.setModifyingState(true);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.setModifyingState(false);
    }, 1000);
  }

  onPredictionInput() {
    if (this.isPredictionDisabled) return;

    if (this.activePowerup === 'reversal' && this.isDrawPrediction) {
      this.activePowerup = null;
    }

    this.calculatePoints();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.setModifyingState(true);
    this.hasUnsavedChanges = true;

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.emitPrediction();
      this.setModifyingState(false);
    }, 1000);
  }

  emitPrediction() {
    if (this.homeGoalsPrediction !== null && this.awayGoalsPrediction !== null) {
      this.hasUnsavedChanges = false;
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
    const predictionObj = {
      homeScore: this.homeGoalsPrediction,
      awayScore: this.awayGoalsPrediction,
      scorerId: this.selectedScorer,
      powerup: this.activePowerup,
      doubleScorerId: this.secondScorer
    };
    const result = calculatePredictionPoints(this.match, this.scoringSystem, predictionObj);
    
    if (result) {
      this.scoredPoints = result.totalPoints;
      this.pointsBreakdown = result.pointsBreakdown;
    } else {
      this.scoredPoints = null;
      this.pointsBreakdown = '';
    }
  }

  getScorerName(id: number | null): string {
    if (!id) return 'None';
    for (const group of this.scorerGroups) {
      const scorer = group.scorers.find(s => s.id === id);
      if (scorer) return scorer.name;
    }
    return 'Unknown';
  }

  getScorersTooltip(): string {
    const scorers = this.match.matchDetails?.scorers || [];
    return scorers.map((s: any) => s.name || s).join('\n');
  }

  loadData() {
    forkJoin({
      home: this.teamService.getTeamDetails(this.match.homeTeamId),
      away: this.teamService.getTeamDetails(this.match.awayTeamId)
    }).subscribe({
      next: ({ home, away }) => {
        this.homeTeam = home;
        this.awayTeam = away;
  
        const homePlayers = this.match.matchDetails?.homeLineup?.players?.length 
          ? [...this.match.matchDetails.homeLineup.players, ...(this.match.matchDetails.homeBench?.players || [])]
          : (home.squad || []);
        const awayPlayers = this.match.matchDetails?.awayLineup?.players?.length 
          ? [...this.match.matchDetails.awayLineup.players, ...(this.match.matchDetails.awayBench?.players || [])]
          : (away.squad || []);
  
        const groupsMap = new Map<string, ScorerGroup>();
  
        const getPosInfo = (pos: string) => {
          if (!pos) return { code: '', order: 99 };
          const p = pos.toLowerCase();
          if (p.includes('goalkeeper')) return { code: '[GK]', order: 1 };
          if (p.includes('defen')) return { code: '[DEF]', order: 2 };
          if (p.includes('midfiel')) return { code: '[MID]', order: 3 };
          if (p.includes('offen') || p.includes('attack') || p.includes('forward')) return { code: '[FW]', order: 4 };
          return { code: '', order: 99 };
        };
  
        const addPlayersToGroup = (players: any[], teamName: string, teamCode: string, team: Team) => {
          if (!groupsMap.has(teamName)) {
            groupsMap.set(teamName, { name: teamName, scorers: [] });
          }
          players.forEach((p: any) => {
            const squadPos = team.squad?.find(sp => sp.id === p.id)?.position || p.position;
            const posInfo = getPosInfo(squadPos);
            groupsMap.get(teamName)!.scorers.push({
              id: p.id,
              name: p.name,
              code: teamCode,
              teamName: teamName,
              order: posInfo.order
            });
          });
        };
  
        const homeName = home.name || 'Home';
        const awayName = away.name || 'Away';
        const homeCode = home.tla || home.shortName || homeName;
        const awayCode = away.tla || away.shortName || awayName;
  
        addPlayersToGroup(homePlayers, homeName, homeCode, home);
        addPlayersToGroup(awayPlayers, awayName, awayCode, away);
  
        this.scorerGroups = Array.from(groupsMap.values())
          .sort((a, b) => a.name.localeCompare(b.name));
  
        this.scorerGroups.forEach(group => {
          group.scorers.sort((a, b) => {
            if (a.order !== b.order) {
              return (a.order || 99) - (b.order || 99);
            }
            return a.name.localeCompare(b.name);
          });
        });
  
        this.cdr.detectChanges();
      },
      error: err => console.error('Error loading team data:', err)
    });
  }
}
