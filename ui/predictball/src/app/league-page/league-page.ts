import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { CompetitionService } from '../services/competition.service';
import { UserService } from '../services/user.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Season } from '../models/competition';

interface Player {
  position: number;
  name: string;
  points: number;
  userId?: number;
}

@Component({
  selector: 'app-league-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    RouterModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './league-page.html',
  styleUrl: './league-page.css',
})
export class LeaguePage implements OnInit {
  leagueId: string | null = null;
  competitionId: string | null = null;
  leagueName = 'League';
  leagueJoinCode = '';
  errorMessage: string | null = null;
  currentUserId: string | null = null;

  season: string | null = null;
  selectedSeason: string = '';
  availableSeasons: Season[] = [];

  players: Player[] = [];
  displayedColumns: string[] = ['position', 'name', 'points'];

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private leagueService = inject(PredictionLeagueService);
  private competitionService = inject(CompetitionService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);

  getSeasonValue(season: Season): string {
    if (season.startDate && season.startDate.length >= 4) {
      return season.startDate.substring(0, 4);
    }
    return season.id ? season.id.toString() : '';
  }

  formatSeasonLabel(season: Season): string {
    let label = '';
    if (season.startDate && season.startDate.length >= 4) {
      label = season.startDate.substring(0, 4);
      if (season.endDate && season.endDate.length >= 4 && season.endDate.substring(0, 4) !== label) {
        label += `/${season.endDate.substring(0, 4)}`;
      }
    } else if (season.id) {
      label = `Season ${season.id}`;
    }
    if (season.isRetired) {
      label += ' (Retired)';
    }
    return label;
  }

  onSeasonChange(seasonVal: string) {
    if (this.selectedSeason === seasonVal) return;
    this.selectedSeason = seasonVal;
    this.season = seasonVal;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { season: this.selectedSeason },
      queryParamsHandling: 'merge'
    });

    this.loadLeague();
  }

  ngOnInit(): void {
    const cookies = this.document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.split('=', 2).map(c => c.trim());
      if (key === 'userId') {
        this.currentUserId = value ? decodeURIComponent(value).replace(/^"|"$/g, '') : null;
        break;
      }
    }

    this.route.queryParamMap.subscribe(queryParams => {
      const querySeason = queryParams.get('season');
      if (querySeason && querySeason !== this.selectedSeason) {
        this.season = querySeason;
        this.selectedSeason = querySeason;
        if (this.competitionId && this.leagueId) {
          this.loadLeague();
        }
      }
    });

    this.route.paramMap.subscribe(params => {
      this.leagueId = params.get('id');
      this.competitionId = params.get('compId') || this.route.parent?.snapshot.paramMap.get('id') || null;

      if (this.competitionId) {
        this.competitionService.getCompetition(this.competitionId).pipe(catchError(() => of(null))).subscribe(comp => {
          if (comp) {
            this.availableSeasons = comp.seasons || (comp.currentSeason ? [comp.currentSeason] : []);
            const querySeason = this.route.snapshot.queryParamMap.get('season');
            if (querySeason && this.availableSeasons.some(s => this.getSeasonValue(s) === querySeason)) {
              this.selectedSeason = querySeason;
            } else if (comp.currentSeason) {
              this.selectedSeason = this.getSeasonValue(comp.currentSeason);
            } else if (this.availableSeasons.length > 0) {
              this.selectedSeason = this.getSeasonValue(this.availableSeasons[0]);
            }
            this.season = this.selectedSeason;
          }
          if (this.competitionId && this.leagueId) {
            this.loadLeague();
          }
        });
      }
    });
  }

  selectCode(event: MouseEvent) {
    const element = event.target as HTMLElement;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  loadLeague() {
    if (!this.competitionId || !this.leagueId) return;

    forkJoin({
      league: this.leagueService.getPredictionLeague(this.competitionId, this.leagueId, this.season || undefined),
      globalLeague: this.leagueService.getPredictionLeague(this.competitionId, 0, this.season || undefined).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ league, globalLeague }: { league: any, globalLeague: any }) => {
        this.errorMessage = null;
        this.leagueName = league.name || 'League';
        this.leagueJoinCode = league.joinCode || '';
        this.cdr.detectChanges();
        
        let users = league.users || [];
        if (users.length === 0 && league.userIds && league.userIds.length > 0) {
          users = league.userIds.map((id: number) => ({
            userId: id,
            name: `Player ${id}`,
            points: 0
          }));
        }

        if (globalLeague && globalLeague.users) {
          users.forEach((u: any) => {
            const globalUser = globalLeague.users.find((gu: any) => gu.userId?.toString() === u.userId?.toString());
            if (globalUser) {
              u.points = globalUser.points || 0;
              u.name = globalUser.name || u.name;
            }
          });
        }

        const userRequests = users
          .filter((u: any) => u.name === `Player ${u.userId}`)
          .map((u: any) =>
            this.userService.getUser(u.userId.toString()).pipe(
              map(userDetails => {
                u.name = userDetails.displayName || u.name;
                return u;
              }),
              catchError(() => of(u))
            )
          );

        const finalizePlayers = () => {
          users.sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
          this.players = users.map((u: any, index: number) => ({
            position: index + 1,
            name: u.name,
            points: u.points || 0,
            userId: u.userId
          }));
          this.cdr.detectChanges();
        };

        if (userRequests.length > 0) {
          forkJoin(userRequests).subscribe({
            next: () => finalizePlayers(),
            error: () => finalizePlayers()
          });
        } else {
          finalizePlayers();
        }
      },
      error: (err) => {
        console.error('Error fetching league details', err);
        this.errorMessage = 'You are not authorized to view this league, or it does not exist.';
        this.cdr.detectChanges();
      }
    });
  }
}
