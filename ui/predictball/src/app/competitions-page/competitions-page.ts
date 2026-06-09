import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CompetitionService } from '../services/competition.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { UserService } from '../services/user.service';
import { Competition as APICompetition } from '../models/competition';

export interface Competition {
  id: string | number;
  code: string;
  name: string;
  score?: number;
  globalRank?: number;
  playersCount: number;
  currentStage: string;
}

@Component({
  selector: 'app-competitions-page',
  imports: [
    CommonModule, 
    RouterModule, 
    MatCardModule, 
    MatTableModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule
  ],
  templateUrl: './competitions-page.html',
  styleUrl: './competitions-page.css',
})
export class CompetitionsPage implements OnInit {
  myCompsColumns: string[] = ['name', 'score', 'globalRank', 'playersCount', 'currentStage'];
  joinCompsColumns: string[] = ['name', 'playersCount', 'currentStage', 'actions'];

  myCompetitionsData: Competition[] = [];
  allCompetitionsData: Competition[] = [];

  myCompetitions = new MatTableDataSource<Competition>();
  availableCompetitions = new MatTableDataSource<Competition>();

  private competitionService = inject(CompetitionService);
  private leagueService = inject(PredictionLeagueService);
  private userService = inject(UserService);
  private document = inject(DOCUMENT);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private userId: string | null = null;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const cookies = this.document.cookie.split('; ');
      const userIdCookie = cookies.find(row => row.startsWith('userId='));
      this.userId = userIdCookie ? userIdCookie.split('=')[1] : null;
    }

    if (!this.userId) {
      console.warn('User is not authenticated.');
      return;
    }

    this.competitionService.getAllCompetitions().subscribe(allComps => {
      this.userService.getYourLeagues(this.userId!).subscribe(userLeagues => {
        const myCompIds = new Set((userLeagues.competitions || []).map(c => c.competitionId.toString()));
        
        const mappedComps: Competition[] = allComps.map((c: APICompetition) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          playersCount: 0,
          currentStage: c.currentSeason?.currentMatchday != null ? `Matchday ${c.currentSeason.currentMatchday}` : 'Unknown',
          score: 0,
          globalRank: 0
        }));

        this.myCompetitionsData = mappedComps.filter(c => myCompIds.has(c.id.toString()));
        this.allCompetitionsData = mappedComps;
        
        this.updateTables();

        mappedComps.forEach(comp => {
          this.leagueService.getPredictionLeague(comp.id, 0).subscribe({
            next: (league: any) => {
              if (league && league.users) {
                comp.playersCount = league.users.length;
                this.updateTables();
              }
            },
            error: () => {}
          });
        });
      });
    });
  }

  updateTables() {
    this.myCompetitions.data = [...this.myCompetitionsData];
    
    const myCompIds = new Set(this.myCompetitionsData.map(c => c.id));
    this.availableCompetitions.data = this.allCompetitionsData.filter(c => !myCompIds.has(c.id));
    this.cdr.detectChanges();
  }

  applyFilterMyComps(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.myCompetitions.filter = filterValue.trim().toLowerCase();
  }

  applyFilterJoinComps(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.availableCompetitions.filter = filterValue.trim().toLowerCase();
  }

  joinCompetition(comp: Competition) {
    if (!this.userId) return;
    this.leagueService.joinGlobalLeague(comp.id, this.userId).subscribe(() => {
      comp.playersCount++;
      this.myCompetitionsData.push({ ...comp, score: 0, globalRank: 0 });
      this.updateTables();
      this.router.navigate(['/competition', comp.code]);
    });
  }
}
