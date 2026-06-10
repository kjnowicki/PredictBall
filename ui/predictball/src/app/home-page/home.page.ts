import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, signal, TemplateRef, ViewChild, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PredictionTileComponent } from '../prediction-tile-component/prediction.tile.component';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { UserService } from '../services/user.service';
import { CompetitionService } from '../services/competition.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { MatchService } from '../services/match.service';
import { Competition } from '../models/competition';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PredictionLeague, Match } from '../models';

interface Task {
  matchId: string;
  matchName: string;
  date: string;
  status: 'missing' | 'invalid';
}

@Component({
  selector: 'app-home.page',
  imports: [
    FormsModule,
    RouterLink,
    CommonModule,
    PredictionTileComponent,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
  competitions: (Competition & { points?: number })[] = [];
  leagues: PredictionLeague[] = [];
  userLeaguesMap: { [competitionId: number]: number[] } = {};

  tasksFeatureEnabled = false;

  tasks: Task[] = [
    { matchId: 't1', matchName: 'Arsenal vs Chelsea', date: '2023-10-21', status: 'missing' },
    { matchId: 't2', matchName: 'Real Madrid vs Bayern', date: '2023-10-24', status: 'invalid' }
  ];

  selectedCompetitionId = signal(-1);
  selectedTask: Task | null = null;
  selectedTaskMatch: Match | null = null;

  leaguesDisplayedColumns: string[] = ['name'];
  tasksDisplayedColumns: string[] = ['matchName', 'date', 'status'];

  readonly dialog = inject(MatDialog);
  private userService = inject(UserService);
  private competitionService = inject(CompetitionService);
  private leagueService = inject(PredictionLeagueService);
  private matchService = inject(MatchService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('taskDialog') taskDialog!: TemplateRef<any>;

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
                  const userRecord = league.users.find((u: any) => u.userId.toString() === userId);
                  if (userRecord) {
                    comp.points = userRecord.points;
                    this.cdr.detectChanges();
                  }
                }
              },
              error: () => {}
            });
          });

          if (this.competitions.length > 0) {
            this.selectedCompetitionId.set(this.competitions[0].id);
            this.loadLeaguesForCompetition(this.competitions[0].id);
          }
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
      this.cdr.detectChanges();
    });
  }

  openTaskModal(task: Task): void {
    this.selectedTask = task;
    this.matchService.getMatch(task.matchId).subscribe({
      next: (match) => {
        this.selectedTaskMatch = match;
        this.dialog.open(this.taskDialog);
      },
      error: (err) => console.error('Error fetching match details for task', err)
    });
  }

  closeModal(): void {
    this.dialog.closeAll();
    this.selectedTask = null;
    this.selectedTaskMatch = null;
  }
}
