import { Component, OnInit, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PredictionTileComponent } from '../prediction-tile-component/prediction.tile.component';
import { CompetitionService } from '../services/competition.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { MatchService } from '../services/match.service';
import { Match } from '../models';

interface PublicLeague {
  id: string;
  name: string;
  participants: number;
}

@Component({
  selector: 'app-competition.page',
  imports: [
    CommonModule, 
    MatCardModule, 
    MatTabsModule, 
    MatTableModule, 
    RouterModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    PredictionTileComponent
  ],
  templateUrl: './competition.page.html',
  styleUrl: './competition.page.css',
})
export class CompetitionPage implements OnInit {
  competitionCode: string | null = null;
  competitionName: string = '';
  matches: Match[] = [];
  selectedMatchday: number = 1;
  
  publicLeagues: PublicLeague[] = [];
  yourLeagues: PublicLeague[] = [];
  joinCode: string = '';
  userId: string | null = null;
  
  leaguesDisplayedColumns: string[] = ['name', 'participants'];

  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private predictionLeagueService = inject(PredictionLeagueService);

  constructor(
    private route: ActivatedRoute,
    private competitionService: CompetitionService,
    private matchService: MatchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const cookies = this.document.cookie.split('; ');
      const userIdCookie = cookies.find(row => row.startsWith('userId='));
      this.userId = userIdCookie ? userIdCookie.split('=')[1] : null;
    }

    this.route.paramMap.subscribe(params => {
      this.competitionCode = params.get('id');
      if (this.competitionCode) {
        this.competitionService.getCompetition(this.competitionCode).subscribe(comp => {
          this.competitionName = comp.name;
          if (comp.currentSeason?.currentMatchday) {
            this.selectedMatchday = comp.currentSeason.currentMatchday;
          }
          this.cdr.detectChanges();
        });
        this.matchService.getMatchSchedule(this.competitionCode).subscribe(matches => {
          this.matches = matches;
          this.cdr.detectChanges();
        });

        this.loadLeagues();
      }
    });
  }

  loadLeagues() {
    if (this.competitionCode && this.userId) {
      this.predictionLeagueService.getCompetitionLeagues(this.competitionCode, this.userId).subscribe(res => {
        this.publicLeagues = res.publicLeagues;
        this.yourLeagues = res.yourLeagues;
        this.cdr.detectChanges();
      });
    }
  }

  joinLeague() {
    if (!this.joinCode.trim() || !this.competitionCode || !this.userId) return;
    this.predictionLeagueService.joinLeagueByCode(this.competitionCode, this.userId, this.joinCode.trim()).subscribe(() => {
      this.joinCode = '';
      this.loadLeagues();
    });
  }

  get filteredMatches() {
    return this.matches.filter(m => m.matchday === this.selectedMatchday);
  }

  prevMatchday() {
    if (this.selectedMatchday > 1) {
      this.selectedMatchday--;
    }
  }

  nextMatchday() {
    this.selectedMatchday++;
  }
}
