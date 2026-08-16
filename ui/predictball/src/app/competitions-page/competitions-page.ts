import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CompetitionService } from '../services/competition.service';
import { MatchService } from '../services/match.service';
import { PredictionService } from '../services/prediction.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { ScoringSystemService } from '../services/scoring-system.service';
import { UserService } from '../services/user.service';
import { Competition as APICompetition } from '../models/competition';
import { Match } from '../models';
import { PredictionTileComponent } from '../prediction-tile-component/prediction.tile.component';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface JoinedMatchTile {
  match: Match;
  competition: APICompetition;
  competitionName: string;
  competitionCode: string;
  prediction?: any;
  availablePowerups?: any;
  powerupsData?: any;
  isMatchOfTheWeek: boolean;
  rawSelectedMatchdayMatchesCount: number;
}

@Component({
  selector: 'app-competitions-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    PredictionTileComponent
  ],
  templateUrl: './competitions-page.html',
  styleUrl: './competitions-page.css',
})
export class CompetitionsPage implements OnInit, OnDestroy {
  tiles: JoinedMatchTile[] = [];
  joinedCompetitions: { id: string | number; name: string; code: string }[] = [];
  selectedCompIds: string[] = [];

  futureDaysToShow = 3;
  loading = true;
  scoringSystem: any = null;

  currentTime: Date = new Date();
  timeZoneString: string = '';
  private timeInterval: any;

  private competitionService = inject(CompetitionService);
  private matchService = inject(MatchService);
  private predictionService = inject(PredictionService);
  private leagueService = inject(PredictionLeagueService);
  private scoringSystemService = inject(ScoringSystemService);
  private userService = inject(UserService);
  private document = inject(DOCUMENT);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private userId: string | null = null;

  ngOnInit() {
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    this.timeZoneString = offset === 0 ? 'UTC' : `UTC${sign}${hours}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}`;

    if (isPlatformBrowser(this.platformId)) {
      this.timeInterval = setInterval(() => {
        this.currentTime = new Date();
        this.cdr.detectChanges();
      }, 1000);

      const cookies = this.document.cookie.split(';');
      for (const cookie of cookies) {
        const [key, value] = cookie.split('=', 2).map(c => c.trim());
        if (key === 'userId') {
          this.userId = value ? decodeURIComponent(value).replace(/^"|"$/g, '') : null;
          break;
        }
      }
    }

    if (!this.userId) {
      console.warn('User is not authenticated.');
      this.loading = false;
      return;
    }

    this.scoringSystemService.getScoringSystem().subscribe({
      next: sys => {
        this.scoringSystem = sys;
      },
      error: err => console.error('Error fetching scoring system:', err)
    });

    this.loadJoinedCalendar();
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  loadJoinedCalendar() {
    if (!this.userId) return;

    forkJoin({
      userLeagues: this.userService.getYourLeagues(this.userId),
      user: this.userService.getUser(this.userId).pipe(catchError(() => of(null))),
      allComps: this.competitionService.getAllCompetitions().pipe(catchError(() => of([])))
    }).subscribe(({ userLeagues, user, allComps }) => {
      const userPrefs = user?.leagueViewPreferences || {};
      const myCompIds = new Set((userLeagues?.competitions || []).map(c => c.competitionId.toString()));
      if (myCompIds.size === 0) {
        this.tiles = [];
        this.joinedCompetitions = [];
        this.selectedCompIds = [];
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }

      const joinedComps = allComps.filter(c => myCompIds.has(c.id.toString()));

      if (joinedComps.length === 0) {
        this.tiles = [];
        this.joinedCompetitions = [];
        this.selectedCompIds = [];
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }

      this.joinedCompetitions = joinedComps.map(c => ({ id: c.id, name: c.name, code: c.code }));
      this.selectedCompIds = this.joinedCompetitions.map(c => c.id.toString());

      const compRequests = joinedComps.map(comp => {
        return forkJoin({
          comp: of(comp),
          matches: this.matchService.getMatchSchedule(comp.code).pipe(
            catchError(() => of([] as Match[])),
            map(res => Array.isArray(res) ? res : [])
          ),
          powerups: this.competitionService.getPowerups(this.userId!, comp.id.toString()).pipe(
            catchError(() => of({ season: '2024', matchdays: [] }))
          ),
          casualData: this.leagueService.getCasualMatches(comp.id).pipe(
            catchError(() => of({ casualMatchIds: [], byMatchday: {} }))
          )
        }).pipe(
          switchMap(({ comp, matches, powerups, casualData }: { comp: APICompetition, matches: Match[], powerups: any, casualData: any }) => {
            if (matches.length === 0) {
              return of({ comp, matches, predictions: {}, powerups, casualMatchIds: new Set<number>() });
            }
            const matchIds = matches.map((m: Match) => m.id);
            return this.competitionService.getPredictions(this.userId!, comp.id.toString(), matchIds).pipe(
              catchError(() => of([])),
              map(preds => {
                const predictionsMap: { [matchId: number]: any } = {};
                if (Array.isArray(preds)) {
                  preds.forEach((p: any) => predictionsMap[p.matchId] = p);
                }
                return {
                  comp,
                  matches,
                  predictions: predictionsMap,
                  powerups: powerups || { season: '2024', matchdays: [] },
                  casualMatchIds: new Set(casualData?.casualMatchIds || [])
                };
              })
            );
          })
        );
      });

      forkJoin(compRequests).subscribe(results => {
        const allTiles: JoinedMatchTile[] = [];

        results.forEach(({ comp, matches, predictions, powerups, casualMatchIds }: any) => {
          const powerupsData = powerups && powerups.matchdays ? powerups : { season: '2024', matchdays: [] };
          const pref = userPrefs[comp.id.toString()] ?? (comp.code ? userPrefs[comp.code] : undefined);
          const viewOnlyCasual = pref !== undefined ? !!pref : false;

          matches.forEach((match: Match) => {
            if (match.homeTeamId === 0 || match.awayTeamId === 0) {
              return;
            }

            const isMotw = casualMatchIds.has(match.id);
            if (viewOnlyCasual && !isMotw) {
              return;
            }

            const matchdayKey = match.matchday > 0 ? match.matchday : match.stage;
            let mdPowerups = powerupsData.matchdays.find((m: any) => m.matchdayNumber === matchdayKey);
            if (!mdPowerups) {
              mdPowerups = { matchdayNumber: matchdayKey, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
              powerupsData.matchdays.push(mdPowerups);
            }

            const groupMatchesCount = matches.filter((m: Match) => (m.matchday > 0 ? m.matchday : m.stage) === matchdayKey).length;

            allTiles.push({
              match,
              competition: comp,
              competitionName: comp.name,
              competitionCode: comp.code,
              prediction: predictions[match.id],
              availablePowerups: mdPowerups,
              powerupsData,
              isMatchOfTheWeek: isMotw,
              rawSelectedMatchdayMatchesCount: groupMatchesCount
            });
          });
        });

        allTiles.sort((a, b) => new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime());

        this.tiles = allTiles;
        this.loading = false;
        this.cdr.detectChanges();
      });
    });
  }

  get dateRangeString(): string {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const futureLimit = new Date(now);
    futureLimit.setDate(futureLimit.getDate() + this.futureDaysToShow);
    futureLimit.setHours(23, 59, 59, 999);

    const formatOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const startStr = yesterday.toLocaleDateString('en-GB', formatOpts);
    const endStr = futureLimit.toLocaleDateString('en-GB', formatOpts);
    const yearStr = futureLimit.getFullYear();

    return `${startStr} – ${endStr} ${yearStr}`;
  }

  get visibleTiles(): JoinedMatchTile[] {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const futureLimit = new Date(now);
    futureLimit.setDate(futureLimit.getDate() + this.futureDaysToShow);
    futureLimit.setHours(23, 59, 59, 999);

    const compFiltered = this.tiles.filter(t =>
      this.selectedCompIds.length === 0 || this.selectedCompIds.includes(t.competition.id.toString())
    );

    return compFiltered.filter(t => {
      const mTime = new Date(t.match.startTime);
      return mTime >= yesterday && mTime <= futureLimit;
    });
  }

  get hasMoreMatches(): boolean {
    const now = new Date();
    const futureLimit = new Date(now);
    futureLimit.setDate(futureLimit.getDate() + this.futureDaysToShow);
    futureLimit.setHours(23, 59, 59, 999);

    const compFiltered = this.tiles.filter(t =>
      this.selectedCompIds.length === 0 || this.selectedCompIds.includes(t.competition.id.toString())
    );

    return compFiltered.some(t => new Date(t.match.startTime) > futureLimit);
  }

  loadMore() {
    this.futureDaysToShow += 7;
    this.cdr.detectChanges();
  }

  onCompFilterChange() {
    this.cdr.detectChanges();
  }

  onPredictionChanged(tile: JoinedMatchTile, predictionData: any) {
    if (!this.userId || !tile.competition || !tile.competition.id) return;

    const matchId = tile.match.id;
    const matchdayKey = tile.match.matchday > 0 ? tile.match.matchday : tile.match.stage;

    let targetMatchdayPowerups = tile.powerupsData?.matchdays?.find((m: any) => m.matchdayNumber === matchdayKey);
    if (!targetMatchdayPowerups && tile.powerupsData) {
      targetMatchdayPowerups = { matchdayNumber: matchdayKey, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
      tile.powerupsData.matchdays.push(targetMatchdayPowerups);
    }

    const oldPrediction = tile.prediction;
    let oldPowerup = null;
    if (targetMatchdayPowerups) {
      if (targetMatchdayPowerups.doubleScorerMatchId === matchId) oldPowerup = 'doubleScorer';
      else if (targetMatchdayPowerups.tripleScoreMatchId === matchId) oldPowerup = 'tripleScore';
      else if (targetMatchdayPowerups.reversalMatchId === matchId) oldPowerup = 'reversal';
    }
    const newPowerup = predictionData.powerup;
    const newDoubleScorerId = predictionData.doubleScorerId || 0;

    const powerupChanged = oldPowerup !== newPowerup;
    const doubleScorerChanged = newPowerup === 'doubleScorer' && targetMatchdayPowerups && targetMatchdayPowerups.doubleScorerId !== newDoubleScorerId;

    if (powerupChanged || doubleScorerChanged) {
      const updatedPowerups = { ...targetMatchdayPowerups };

      if (powerupChanged) {
        if (oldPowerup === 'doubleScorer') { updatedPowerups.doubleScorerMatchId = 0; updatedPowerups.doubleScorerId = 0; }
        if (oldPowerup === 'tripleScore') updatedPowerups.tripleScoreMatchId = 0;
        if (oldPowerup === 'reversal') updatedPowerups.reversalMatchId = 0;

        if (newPowerup === 'doubleScorer') { updatedPowerups.doubleScorerMatchId = matchId; updatedPowerups.doubleScorerId = newDoubleScorerId; }
        if (newPowerup === 'tripleScore') updatedPowerups.tripleScoreMatchId = matchId;
        if (newPowerup === 'reversal') updatedPowerups.reversalMatchId = matchId;
      } else if (doubleScorerChanged) {
        updatedPowerups.doubleScorerId = newDoubleScorerId;
      }

      tile.availablePowerups = updatedPowerups;
      if (tile.powerupsData && tile.powerupsData.matchdays) {
        const mdIndex = tile.powerupsData.matchdays.findIndex((m: any) => m.matchdayNumber === matchdayKey);
        if (mdIndex > -1) {
          tile.powerupsData.matchdays[mdIndex] = updatedPowerups;
        }
      }

      this.competitionService.savePowerups(this.userId, tile.competition.id.toString(), tile.powerupsData).subscribe({
        error: err => console.error('Failed to save powerups:', err)
      });
    }

    const prediction = {
      ...oldPrediction,
      matchId: matchId,
      userId: parseInt(this.userId, 10),
      homeScore: predictionData.homeScore,
      awayScore: predictionData.awayScore,
      scorerId: predictionData.scorerId,
      powerup: predictionData.powerup,
      doubleScorerId: predictionData.doubleScorerId
    };

    this.competitionService.savePrediction(this.userId, tile.competition.id.toString(), matchId, prediction).subscribe({
      next: (saved) => {
        if (saved) {
          saved.powerup = prediction.powerup;
          tile.prediction = saved;
        } else {
          tile.prediction = prediction;
        }
        this.cdr.detectChanges();
      },
      error: err => console.error('Error saving prediction:', err)
    });
  }
}
