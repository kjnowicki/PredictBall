import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { UserService } from '../services/user.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface Player {
  position: number;
  name: string;
  points: number;
}

@Component({
  selector: 'app-league-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule
  ],
  templateUrl: './league-page.html',
  styleUrl: './league-page.css',
})
export class LeaguePage implements OnInit {
  leagueId: string | null = null;
  competitionId: string | null = null;
  leagueName = 'League';
  leagueJoinCode = '';

  players: Player[] = [];
  displayedColumns: string[] = ['position', 'name', 'points'];

  private route = inject(ActivatedRoute);
  private leagueService = inject(PredictionLeagueService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.leagueId = params.get('id');
      this.competitionId = params.get('compId') || this.route.parent?.snapshot.paramMap.get('id') || null;

      if (this.competitionId && this.leagueId) {
        this.loadLeague();
      }
    });
  }

  loadLeague() {
    if (!this.competitionId || !this.leagueId) return;

    this.leagueService.getPredictionLeague(this.competitionId, this.leagueId).subscribe({
      next: (league: any) => {
        this.leagueName = league.name || 'League';
        this.leagueJoinCode = league.joinCode || '';
        
        let users = league.users || [];
        if (users.length === 0 && league.userIds && league.userIds.length > 0) {
          users = league.userIds.map((id: number) => ({
            userId: id,
            name: `Player ${id}`,
            points: 0
          }));
        }

        const userRequests = users.map((u: any) =>
          this.userService.getUser(u.userId.toString()).pipe(
            map(userDetails => ({ ...u, name: userDetails.displayName || u.name })),
            catchError(() => of(u))
          )
        );

        if (userRequests.length > 0) {
          forkJoin(userRequests).subscribe((populatedUsers: any) => {
            populatedUsers.sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
            this.players = populatedUsers.map((u: any, index: number) => ({
              position: index + 1,
              name: u.name,
              points: u.points || 0
            }));
            this.cdr.detectChanges();
          });
        } else {
          this.players = [];
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Error fetching league details', err)
    });
  }
}
