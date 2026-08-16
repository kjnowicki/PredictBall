import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, signal, inject, PLATFORM_ID, ChangeDetectorRef, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { UserService } from '../services/user.service';
import { CompetitionService } from '../services/competition.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { MatchService } from '../services/match.service';
import { Competition as APICompetition } from '../models/competition';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { PredictionLeague, GlobalLeague } from '../models/predictball.models';
import { Match } from '../models';

export interface CompetitionTableItem {
  id: string | number;
  code: string;
  name: string;
  score?: number;
  globalRank?: number;
  playersCount: number;
  currentStage: string;
  isRetired?: boolean;
}

interface Task {
  competitionId: number;
  competitionName: string;
  competitionCode: string;
  matchday: number | string;
  startTime: Date;
  isPast: boolean;
  predictionsMissingCount: number;
}

@Component({
  selector: 'app-home.page',
  imports: [
    FormsModule,
    RouterLink,
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatCheckboxModule,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
  myCompsColumns: string[] = ['name', 'score', 'globalRank', 'playersCount', 'currentStage'];
  joinCompsColumns: string[] = ['name', 'playersCount', 'currentStage', 'actions'];

  showInactiveCompetitions = false;

  myCompetitionsData: CompetitionTableItem[] = [];
  allCompetitionsData: CompetitionTableItem[] = [];

  myCompetitions = new MatTableDataSource<CompetitionTableItem>();
  availableCompetitions = new MatTableDataSource<CompetitionTableItem>();

  competitions: (APICompetition & { points?: number })[] = [];
  leagues: (PredictionLeague & { participants?: number; rank?: number })[] = [];
  globalLeagues: { [competitionId: number]: GlobalLeague } = {};
  userLeaguesMap: { [competitionId: number]: number[] } = {};

  tasksFeatureEnabled = true;
  tasks: Task[] = [];

  selectedCompetitionId = signal(-1);
  currentUserId: number | null = null;
  private dialogRef: MatDialogRef<any> | null = null;

  tasksDisplayedColumns: string[] = ['goTo', 'competitionName', 'matchday', 'startTime', 'predictionsMissingCount'];

  private userService = inject(UserService);
  private competitionService = inject(CompetitionService);
  private leagueService = inject(PredictionLeagueService);
  private matchService = inject(MatchService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    let userId: string | null = null;
    
    if (isPlatformBrowser(this.platformId)) {
      const cookies = this.document.cookie.split(';');
      for (const cookie of cookies) {
        const [key, value] = cookie.split('=', 2).map(c => c.trim());
        if (key === 'userId') {
          userId = value ? decodeURIComponent(value).replace(/^"|"$/g, '') : null;
          break;
        }
      }
    }
    
    if (userId == undefined || userId == null) {
      console.warn('User is not authenticated.');
      return;
    }
    
    this.currentUserId = parseInt(userId, 10);

    this.competitionService.getAllCompetitions().subscribe(allComps => {
      this.userService.getYourLeagues(userId!).subscribe(userLeagues => {
        const myCompIds = new Set((userLeagues.competitions || []).map(c => c.competitionId.toString()));

        const mappedComps: CompetitionTableItem[] = allComps.map((c: APICompetition) => {
          const isRetired = !c.currentSeason || !!c.currentSeason.isRetired;
          return {
            id: c.id,
            code: c.code,
            name: c.name,
            playersCount: 0,
            currentStage: isRetired
              ? 'Retired'
              : (c.currentSeason?.currentMatchday != null ? `Matchday ${c.currentSeason.currentMatchday}` : 'Unknown'),
            score: undefined,
            globalRank: undefined,
            isRetired
          };
        });

        this.myCompetitionsData = mappedComps.filter(c => myCompIds.has(c.id.toString()));
        this.allCompetitionsData = mappedComps;
        this.competitions = allComps.filter(c => myCompIds.has(c.id.toString()));

        this.updateTables();

        mappedComps.forEach(comp => {
          this.leagueService.getPredictionLeague(comp.id, 0).subscribe({
            next: (league: GlobalLeague) => {
              comp.playersCount = league.users.length;
              const sortedUsers = [...league.users].sort((a, b) => (b.points || 0) - (a.points || 0));
              const userInLeague = sortedUsers.find(u => u.userId === Number(userId));
              comp.score = userInLeague ? userInLeague.points : undefined;
              const userIndex = sortedUsers.findIndex(u => u.userId === Number(userId));
              comp.globalRank = userIndex !== -1 ? userIndex + 1 : undefined;
              this.updateTables();
            },
            error: () => { }
          });
        });

        this.loadTasks(userId!);
      });
    });
  }

  updateTables() {
    const filteredMy = this.showInactiveCompetitions
      ? this.myCompetitionsData
      : this.myCompetitionsData.filter(c => !c.isRetired);
    this.myCompetitions.data = [...filteredMy];

    const myCompIds = new Set(this.myCompetitionsData.map(c => c.id.toString()));
    const availableFiltered = this.showInactiveCompetitions
      ? this.allCompetitionsData.filter(c => !myCompIds.has(c.id.toString()))
      : this.allCompetitionsData.filter(c => !myCompIds.has(c.id.toString()) && !c.isRetired);
    this.availableCompetitions.data = availableFiltered;
    this.cdr.detectChanges();
  }

  openJoinModal(templateRef: TemplateRef<any>) {
    this.dialogRef = this.dialog.open(templateRef, {
      width: '600px',
      maxWidth: '90vw'
    });
  }

  closeJoinModal() {
    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = null;
    }
  }

  joinCompetition(comp: CompetitionTableItem) {
    if (!this.currentUserId) return;
    this.leagueService.joinGlobalLeague(comp.id, this.currentUserId.toString()).subscribe(() => {
      comp.playersCount++;
      this.myCompetitionsData.push({ ...comp, score: 0, globalRank: 0 });
      const apiComp = this.allCompetitionsData.find(c => c.id === comp.id);
      if (apiComp) {
        this.competitions.push(apiComp as any);
      }
      this.updateTables();
      if (this.currentUserId) {
        this.loadTasks(this.currentUserId.toString());
      }
    });
  }

  getCompSeason(comp?: APICompetition): string {
    if (!comp) return '';
    if (comp.currentSeason?.startDate && comp.currentSeason.startDate.length >= 4) {
      return comp.currentSeason.startDate.substring(0, 4);
    }
    if (comp.seasons && comp.seasons.length > 0) {
      const s = comp.seasons[0];
      if (s.startDate && s.startDate.length >= 4) {
        return s.startDate.substring(0, 4);
      }
      if (s.id) return s.id.toString();
    }
    return comp.currentSeason?.id ? comp.currentSeason.id.toString() : '';
  }

  formatMatchdayHeader(val: number | string): string {
    if (typeof val === 'number') {
      return `Matchday ${val}`;
    }
    const num = Number(val);
    if (!isNaN(num)) {
      return `Matchday ${num}`;
    }
    return val
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace('Of', 'of');
  }

  loadTasks(userId: string) {
    if (this.competitions.length === 0) {
      this.tasks = [];
      this.cdr.detectChanges();
      return;
    }

    const tasksRequests = this.competitions.map(comp => {
      return forkJoin({
        matches: this.matchService.getMatchSchedule(comp.code).pipe(
          catchError(() => of([] as Match[])),
          map(matches => (Array.isArray(matches) ? matches : []))
        ),
        casualData: this.leagueService.getCasualMatches(comp.id).pipe(
          catchError(() => of({ casualMatchIds: [], byMatchday: {} }))
        )
      }).pipe(
        switchMap(({ matches, casualData }) => {
          if (matches.length === 0) {
            return of({ comp, matches: [] as Match[], predictions: [] as any[], casualMatchIds: [] as number[] });
          }
          const matchIds = matches.map(m => m.id);
          return this.competitionService.getPredictions(userId, comp.id.toString(), matchIds).pipe(
            catchError(() => of([] as any[])),
            map(predictions => ({
              comp,
              matches,
              predictions: Array.isArray(predictions) ? predictions : [],
              casualMatchIds: casualData?.casualMatchIds || []
            }))
          );
        })
      );
    });

    forkJoin({
      user: this.userService.getUser(userId).pipe(catchError(() => of(null))),
      taskResults: forkJoin(tasksRequests)
    }).subscribe(({ user, taskResults }) => {
      const prefs = user?.leagueViewPreferences || {};
      const allTasks: Task[] = [];
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      taskResults.forEach(({ comp, matches, predictions, casualMatchIds }) => {
        const safeMatches = Array.isArray(matches) ? matches : [];
        const safePredictions = Array.isArray(predictions) ? predictions : [];
        const casualSet = new Set(casualMatchIds);

        if (safeMatches.length === 0) return;

        const matchdayGroups: { [key: string]: Match[] } = {};
        safeMatches.forEach(m => {
          if (m.homeTeamId === 0 || m.awayTeamId === 0) {
            return;
          }
          const key = m.matchday > 0 ? m.matchday.toString() : m.stage;
          if (!key) return;
          if (!matchdayGroups[key]) {
            matchdayGroups[key] = [];
          }
          matchdayGroups[key].push(m);
        });

        const predictionsMap: { [key: number]: any } = {};
        safePredictions.forEach(p => {
          predictionsMap[p.matchId] = p;
        });

        const groupSummaries: {
          matchday: number | string;
          firstMatchTime: Date;
          groupMatches: Match[];
          hasUnfinished: boolean;
        }[] = [];

        Object.keys(matchdayGroups).forEach(groupKey => {
          const groupMatches = matchdayGroups[groupKey];
          if (groupMatches.length === 0) return;

          const parsedNum = parseInt(groupKey, 10);
          const matchday = isNaN(parsedNum) ? groupKey : parsedNum;

          let firstMatch = groupMatches[0];
          for (let i = 1; i < groupMatches.length; i++) {
            if (new Date(groupMatches[i].startTime) < new Date(firstMatch.startTime)) {
              firstMatch = groupMatches[i];
            }
          }

          const firstMatchTime = new Date(firstMatch.startTime);
          const hasUnfinished = groupMatches.some(m => m.status !== 'FINISHED');

          groupSummaries.push({
            matchday,
            firstMatchTime,
            groupMatches,
            hasUnfinished
          });
        });

        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const unfinishedGroups = groupSummaries
          .filter(g => g.hasUnfinished && g.firstMatchTime >= fourteenDaysAgo)
          .sort((a, b) => a.firstMatchTime.getTime() - b.firstMatchTime.getTime());

        const targetGroups = unfinishedGroups.slice(0, 2);

        const pref = prefs[comp.id.toString()] ?? (comp.code ? prefs[comp.code] : undefined);
        const isCasualContext = casualSet.size > 0 && (
          pref !== undefined ? !!pref : false
        );

        targetGroups.forEach(g => {
          let missingCount = 0;
          g.groupMatches.forEach(m => {
            if (m.status === 'FINISHED') {
              return;
            }
            if (isCasualContext && !casualSet.has(m.id)) {
              return;
            }
            const p = predictionsMap[m.id];
            let isComplete = false;
            if (p) {
              const homeScore = p.homeScore;
              const awayScore = p.awayScore;
              const areScoresSet = homeScore !== null && homeScore !== undefined &&
                                   awayScore !== null && awayScore !== undefined &&
                                   homeScore !== '';
              if (areScoresSet) {
                const isDrawZero = (Number(homeScore) + Number(awayScore) === 0);
                const isScorerSelected = !!p.scorerId && p.scorerId !== 0;
                if (isDrawZero || isScorerSelected) {
                  isComplete = true;
                }
              }
            }
            if (!isComplete) {
              missingCount++;
            }
          });

          if (missingCount > 0) {
            allTasks.push({
              competitionId: comp.id,
              competitionName: comp.name,
              competitionCode: comp.code,
              matchday: g.matchday,
              startTime: g.firstMatchTime,
              isPast: g.firstMatchTime <= oneDayFromNow,
              predictionsMissingCount: missingCount
            });
          }
        });
      });

      allTasks.sort((a, b) => {
        const compCompare = a.competitionName.localeCompare(b.competitionName);
        if (compCompare !== 0) return compCompare;
        return a.startTime.getTime() - b.startTime.getTime();
      });

      this.tasks = allTasks;
      this.cdr.detectChanges();
    });
  }
}
