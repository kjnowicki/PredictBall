import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, signal, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../services/user.service';
import { CompetitionService } from '../services/competition.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { MatchService } from '../services/match.service';
import { Competition } from '../models/competition';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { PredictionLeague, GlobalLeague } from '../models/predictball.models';
import { Match } from '../models';

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
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
  competitions: (Competition & { points?: number })[] = [];
  leagues: (PredictionLeague & { participants?: number; rank?: number })[] = [];
  globalLeagues: { [competitionId: number]: GlobalLeague } = {};
  userLeaguesMap: { [competitionId: number]: number[] } = {};

  tasksFeatureEnabled = true;

  tasks: Task[] = [];

  selectedCompetitionId = signal(-1);
  currentUserId: number | null = null;

  leaguesDisplayedColumns: string[] = ['name', 'participants', 'rank'];
  tasksDisplayedColumns: string[] = ['goTo', 'competitionName', 'matchday', 'startTime', 'predictionsMissingCount'];

  private userService = inject(UserService);
  private competitionService = inject(CompetitionService);
  private leagueService = inject(PredictionLeagueService);
  private matchService = inject(MatchService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

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

    this.userService.getYourLeagues(userId).subscribe((userLeagues) => {
      const comps = userLeagues.competitions || [];
      this.userLeaguesMap = {};
      comps.forEach(c => this.userLeaguesMap[c.competitionId] = c.leagueIds);
      
      const compIds = comps.map(c => c.competitionId);

      if (compIds.length > 0) {
        const compRequests = compIds.map(id =>
          this.competitionService.getCompetition(id.toString()).pipe(
            catchError(() => of(null))
          )
        );

        forkJoin(compRequests).subscribe((comps: any[]) => {
          this.competitions = comps.filter(c => c !== null).map(c => ({ ...c, points: 0 }));
          
          this.competitions.forEach(comp => {
            this.leagueService.getPredictionLeague(comp.id, 0).subscribe({
              next: (league: any) => {
                if (league && league.users) {
                  this.globalLeagues[comp.id] = league;
                  const userRecord = league.users.find((u: any) => u.userId.toString() === userId);
                  if (userRecord) {
                    comp.points = userRecord.points;
                  }
                  
                  if (this.selectedCompetitionId() === comp.id) {
                    this.updateLeaguesData();
                  }
                  this.cdr.detectChanges();
                }
              },
              error: () => {}
            });
          });

          if (this.competitions.length > 0) {
            this.selectedCompetitionId.set(this.competitions[0].id);
            this.loadLeaguesForCompetition(this.competitions[0].id);
          }
          this.loadTasks(userId);
          this.cdr.detectChanges();
        });
      }
    });
  }

  get currentCompetition(): (Competition & { points?: number }) | undefined {
    return this.competitions.find(c => c.id === this.selectedCompetitionId());
  }

  onCompetitionChange(compId: number) {
    this.selectedCompetitionId.set(compId);
    this.loadLeaguesForCompetition(compId);
  }

  loadLeaguesForCompetition(compId: number) {
    const leagueIds = this.userLeaguesMap[compId] || [];
    if (leagueIds.length === 0) {
      this.leagues = [];
      this.cdr.detectChanges();
      return;
    }

    const leagueReqs = leagueIds.map(id =>
      this.leagueService.getPredictionLeague(compId, id.toString()).pipe(
        catchError(() => of(null))
      )
    );
    forkJoin(leagueReqs).subscribe(leagues => {
      this.leagues = leagues.filter(l => l !== null);
      this.updateLeaguesData();
      this.cdr.detectChanges();
    });
  }

  updateLeaguesData() {
    const compId = this.selectedCompetitionId();
    const globalLeague = this.globalLeagues[compId];

    this.leagues = this.leagues.map(l => {
      let participants = 0;
      let rank = 0;
      
      const isGlobal = l.id === 0 || l.id === '0';
      const actualLeague = isGlobal && globalLeague ? globalLeague : l;

      if ((actualLeague as any).users) {
         participants = (actualLeague as any).users.length;
         if (this.currentUserId) {
           const sortedUsers = [...(actualLeague as any).users].sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
           rank = sortedUsers.findIndex((u: any) => u.userId === this.currentUserId) + 1;
         }
      } else if (l.userIds) {
         participants = l.userIds.length;
         if (globalLeague && this.currentUserId && l.userIds.includes(this.currentUserId)) {
           const leagueUsers = globalLeague.users.filter(u => l.userIds!.includes(u.userId));
           const sortedUsers = leagueUsers.sort((a, b) => (b.points || 0) - (a.points || 0));
           rank = sortedUsers.findIndex(u => u.userId === this.currentUserId) + 1;
         }
      }

      return { ...l, participants, rank };
    });
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
      return this.matchService.getMatchSchedule(comp.code).pipe(
        catchError(() => of([] as Match[])),
        map(matches => (Array.isArray(matches) ? matches : [])),
        switchMap(matches => {
          if (matches.length === 0) {
            return of({ comp, matches: [] as Match[], predictions: [] as any[] });
          }
          const matchIds = matches.map(m => m.id);
          return this.competitionService.getPredictions(userId, comp.id.toString(), matchIds).pipe(
            catchError(() => of([] as any[])),
            map(predictions => ({ comp, matches, predictions: Array.isArray(predictions) ? predictions : [] }))
          );
        })
      );
    });

    forkJoin(tasksRequests).subscribe(results => {
      const allTasks: Task[] = [];
      const now = new Date();
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      results.forEach(({ comp, matches, predictions }) => {
        const safeMatches = Array.isArray(matches) ? matches : [];
        const safePredictions = Array.isArray(predictions) ? predictions : [];

        if (safeMatches.length === 0) return;

        // Group matches by matchday or stage
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

        // Map predictions by matchId
        const predictionsMap: { [key: number]: any } = {};
        safePredictions.forEach(p => {
          predictionsMap[p.matchId] = p;
        });

        // Collect matchday summaries
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

        // Filter for upcoming/active matchdays that have unfinished matches and haven't expired long ago
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const unfinishedGroups = groupSummaries
          .filter(g => g.hasUnfinished && g.firstMatchTime >= fourteenDaysAgo)
          .sort((a, b) => a.firstMatchTime.getTime() - b.firstMatchTime.getTime());

        // Focus on the immediate next upcoming matchdays (e.g. earliest 2 unfinished matchdays)
        const targetGroups = unfinishedGroups.slice(0, 2);

        targetGroups.forEach(g => {
          // Count missing predictions
          let missingCount = 0;
          g.groupMatches.forEach(m => {
            if (m.status === 'FINISHED') {
              return;
            }
            const p = predictionsMap[m.id];
            let isComplete = false;
            if (p) {
              const homeScore = p.homeScore;
              const awayScore = p.awayScore;
              const areScoresSet = homeScore !== null && homeScore !== undefined &&
                                   awayScore !== null && awayScore !== undefined &&
                                   homeScore !== '' && awayScore !== '';
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

      // Grouped by competition (sort by competition name first, then chronologically by matchday start time)
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
