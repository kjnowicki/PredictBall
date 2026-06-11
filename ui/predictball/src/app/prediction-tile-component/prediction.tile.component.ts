import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Match } from '../models';
import { TeamService } from '../services/team.service';
import { Team } from '../models/team';
import { forkJoin } from 'rxjs';

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

interface ScorePointsResult {
  points: number;
  resultPoints: number;
  goalsPoints: number;
  goalDifPoints: number;
  homePoints: number;
  awayPoints: number;
  isExact: boolean;
}

interface ScorerPointsResult {
  points: number;
  firstScorerCorrect: boolean;
  secondScorerCorrect: boolean;
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
    MatIconModule,
    MatTooltipModule
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
  @Output() isModifying = new EventEmitter<boolean>();

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
  pointsBreakdown: string = '';
  timeZoneString: string = '';

  isPast: boolean = false;
  isLive: boolean = false;
  isSelectOpen: boolean = false;
  private saveTimeout: any;
  private _isCurrentlyModifying = false;
  private initialScorer: number | null = null;
  private initialSecondScorer: number | null = null;

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
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['prediction'] && this.prediction) {
      this.homeGoalsPrediction = this.prediction.homeScore;
      this.awayGoalsPrediction = this.prediction.awayScore;
      this.selectedScorer = this.prediction.scorerId === 0 ? null : this.prediction.scorerId;
      if (!this.activePowerup) {
        this.activePowerup = this.prediction.powerup || null;
      }
    }
    if (changes['availablePowerups'] && this.availablePowerups) {
      if (this.availablePowerups.doubleScorerMatchId === this.match.id) {
        this.activePowerup = 'doubleScorer';
        this.secondScorer = this.availablePowerups.doubleScorerId === 0 ? null : this.availablePowerups.doubleScorerId;
      } else if (this.availablePowerups.tripleScoreMatchId === this.match.id) {
        this.activePowerup = 'tripleScore';
      } else if (this.availablePowerups.reversalMatchId === this.match.id) {
        this.activePowerup = 'reversal';
      } else {
        this.activePowerup = null;
      }
    }
    if (changes['scoringSystem'] || changes['prediction'] || changes['availablePowerups'] || changes['match']) {
      this.calculatePoints();
    }
  }

  checkStatus() {
    const start = new Date(this.match.startTime);
    this.isLive = this.match.status === 'IN_PLAY' || this.match.status === 'PAUSED';
    this.isPast = start.getTime() < Date.now() || (this.match.status !== 'SCHEDULED' && this.match.status !== 'TIMED');
  }

  getCardStyle(): any {
    if (this.isLive) {
      return { 'background-color': '#ffe0b2', 'border': '2px solid red' };
    } else if (this.isPast) {
      return { 'background-color': '#81c784', 'border': '2px solid black' };
    }
    return { 'background-color': '#b1ecb6' };
  }

  onSelectOpened(isOpen: boolean) {
    this.isSelectOpen = isOpen;
    if (isOpen) {
      this.initialScorer = this.selectedScorer;
      this.initialSecondScorer = this.secondScorer;
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
    } else {
      if (this.initialScorer !== this.selectedScorer || this.initialSecondScorer !== this.secondScorer) {
        this.onPredictionInput();
      }
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
      this.saveTimeout = null;
    }

    this.emitPrediction();
    this.setModifyingState(false);
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

    this.setModifyingState(true);

    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.emitPrediction();
      this.setModifyingState(false);
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
    if (!this.canCalculatePoints()) {
      this.scoredPoints = null;
      this.pointsBreakdown = '';
      return;
    }

    const { predHome, predAway, reversalHelped } = this.applyReversalPowerup();

    const scoreResult = this.calculateScorePoints(predHome, predAway);
    const scorerResult = this.calculateScorerPoints();

    let totalPoints = scoreResult.points + scorerResult.points;

    if (this.activePowerup === 'tripleScore') {
      totalPoints *= 3;
    }

    this.scoredPoints = totalPoints;
    this.pointsBreakdown = this.buildPointsBreakdown(scoreResult, scorerResult, reversalHelped);
  }

  private canCalculatePoints(): boolean {
    return !!(this.scoringSystem &&
      this.match &&
      this.match.matchDetails &&
      this.match.status === 'FINISHED' &&
      this.homeGoalsPrediction !== null &&
      this.awayGoalsPrediction !== null);
  }

  private applyReversalPowerup(): { predHome: number, predAway: number, reversalHelped: boolean } {
    const actualHome = this.match.matchDetails!.homeScore;
    const actualAway = this.match.matchDetails!.awayScore;
    let predHome = this.homeGoalsPrediction!;
    let predAway = this.awayGoalsPrediction!;
    let reversalHelped = false;

    if (this.activePowerup === 'reversal' && actualHome !== actualAway) {
      const actualDiff = actualHome - actualAway;
      const predDiff = predHome - predAway;
      if ((actualDiff > 0 && predDiff < 0) || (actualDiff < 0 && predDiff > 0)) {
        [predHome, predAway] = [predAway, predHome];
        reversalHelped = true;
      }
    }
    return { predHome, predAway, reversalHelped };
  }

  private calculateScorePoints(predHome: number, predAway: number): ScorePointsResult {
    const actualHome = this.match.matchDetails!.homeScore;
    const actualAway = this.match.matchDetails!.awayScore;

    let points = 0;
    let resultPoints = 0;
    let goalsPoints = 0;
    let goalDifPoints = 0;
    let homePoints = 0;
    let awayPoints = 0;
    let isExact = false;

    if (actualHome === predHome && actualAway === predAway) {
      isExact = true;
      goalsPoints = (this.scoringSystem.scoreExact || 0) + (this.scoringSystem.exactScore || 0);
      points += goalsPoints;
    } else {
      if (actualHome === predHome) {
        homePoints = (this.scoringSystem.scoreHomeExact || 0) + (this.scoringSystem.teamGoals || 0);
        goalsPoints += homePoints;
      }
      if (actualAway === predAway) {
        awayPoints = (this.scoringSystem.scoreAwayExact || 0) + (this.scoringSystem.teamGoals || 0);
        goalsPoints += awayPoints;
      }
      points += goalsPoints;

      if (Math.sign(actualHome - actualAway) === Math.sign(predHome - predAway)) {
        resultPoints = this.scoringSystem.result || 0;
        points += resultPoints;
      }
      if (actualHome - actualAway === predHome - predAway) {
        goalDifPoints = (this.scoringSystem.scoreDif || 0) + (this.scoringSystem.goalDif || 0);
        points += goalDifPoints;
      }
    }

    return { points, resultPoints, goalsPoints, goalDifPoints, homePoints, awayPoints, isExact };
  }

  private calculateScorerPoints(): ScorerPointsResult {
    const actualScorers = this.match.matchDetails!.scorers?.map((s: any) => s.id) || [];
    const scorerCounts: Record<number, number> = {};
    actualScorers.forEach((id: number) => {
      scorerCounts[id] = (scorerCounts[id] || 0) + 1;
    });

    let scorerPoints = 0;
    let firstScorerCorrect = false;
    let secondScorerCorrect = false;

    if (actualScorers.length === 0 && (!this.selectedScorer || this.selectedScorer === 0)) {
      scorerPoints += this.scoringSystem.scorer || 0;
      firstScorerCorrect = true;
    } else if (this.selectedScorer && scorerCounts[this.selectedScorer] > 0) {
      scorerPoints += this.scoringSystem.scorer || 0;
      scorerCounts[this.selectedScorer]--;
      firstScorerCorrect = true;
    }

    if (this.activePowerup === 'doubleScorer' && this.secondScorer && scorerCounts[this.secondScorer] > 0) {
      scorerPoints += this.scoringSystem.scorer || 0;
      scorerCounts[this.secondScorer]--;
      secondScorerCorrect = true;
    }

    if (firstScorerCorrect && secondScorerCorrect) {
      scorerPoints += this.scoringSystem.bothScorers || 0;
    }

    return { points: scorerPoints, firstScorerCorrect, secondScorerCorrect };
  }

  private buildPointsBreakdown(
    scoreResult: ScorePointsResult,
    scorerResult: ScorerPointsResult,
    reversalHelped: boolean
  ): string {
    const breakdown: string[] = [];

    if (scoreResult.resultPoints > 0) breakdown.push(`Result: ${scoreResult.resultPoints} pts`);

    const goalsText: string[] = [];
    if (scoreResult.isExact) {
      goalsText.push('Exact');
    } else {
      if (scoreResult.homePoints > 0) goalsText.push('Home');
      if (scoreResult.awayPoints > 0) goalsText.push('Away');
    }
    if (scoreResult.goalsPoints > 0) {
      breakdown.push(`Goals: ${scoreResult.goalsPoints} pts (${goalsText.join(' + ')})`);
    }

    if (scoreResult.goalDifPoints > 0) breakdown.push(`Goal difference: ${scoreResult.goalDifPoints} pts`);

    const scorerText: string[] = [];
    if (scorerResult.firstScorerCorrect) scorerText.push('normal');
    if (scorerResult.secondScorerCorrect) scorerText.push('additional');
    if (scorerResult.points > 0) {
      breakdown.push(`Scorers: ${scorerResult.points} pts (${scorerText.join(' + ')})`);
    }

    if (this.activePowerup === 'tripleScore') {
      breakdown.push('x3');
    }

    if (reversalHelped) {
      breakdown.push('SCORE REVERSAL USED!');
    }

    return breakdown.join('\n');
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
            name: posInfo.code ? `${posInfo.code} ${p.name}` : p.name,
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
    });
  }
}
