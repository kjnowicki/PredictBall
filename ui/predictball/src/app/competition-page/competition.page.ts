import { Component, OnInit, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { TeamService } from '../services/team.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Match } from '../models';
import { Competition } from '../models/competition';

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
  competition: Competition | null = null;
  matches: Match[] = [];
  predictions: Record<number, any> = {};
  selectedMatchday: number = 1;
  powerupsData: any = null;
  currentMatchdayPowerups: any = { matchdayNumber: 1, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
  
  publicLeagues: PublicLeague[] = [];
  yourLeagues: PublicLeague[] = [];
  joinCode: string = '';
  newLeagueName: string = '';
  isCreatingLeague: boolean = false;
  userId: string | null = null;
  
  leaguesDisplayedColumns: string[] = ['name', 'participants'];
  teams: any[] = [];
  teamsDisplayedColumns: string[] = ['crest', 'name'];

  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private predictionLeagueService = inject(PredictionLeagueService);
  private router = inject(Router);
  private teamService = inject(TeamService);

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
          this.competition = comp;
          if (comp.currentSeason?.currentMatchday) {
            this.selectedMatchday = comp.currentSeason.currentMatchday;
          }
          this.loadPowerups();
          this.cdr.detectChanges();
        });
        this.matchService.getMatchSchedule(this.competitionCode).subscribe(matches => {
          this.matches = matches;
          this.extractTeams();
          this.loadPredictions();
          this.cdr.detectChanges();
        });

        this.loadLeagues();
      }
    });
  }

  loadPowerups() {
    if (this.competitionCode && this.userId) {
      this.competitionService.getPowerups(this.userId, this.competitionCode).subscribe(data => {
        if (!data || !data.season) {
          data = { season: this.competition?.currentSeason?.startDate?.substring(0, 4) || '2024', matchdays: [] };
        }
        this.powerupsData = data;
        this.updateCurrentMatchdayPowerups();
      });
    }
  }

  updateCurrentMatchdayPowerups() {
    if (!this.powerupsData) return;
    if (!this.powerupsData.matchdays) this.powerupsData.matchdays = [];
    let md = this.powerupsData.matchdays.find((m: any) => m.matchdayNumber === this.selectedMatchday);
    if (!md) {
      md = { matchdayNumber: this.selectedMatchday, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
      this.powerupsData.matchdays.push(md);
    }
    this.currentMatchdayPowerups = md;
    this.cdr.detectChanges();
  }

  loadPredictions() {
    if (this.competitionCode && this.userId && this.matches.length > 0) {
      const matchIds = this.matches.map(m => m.id);
      this.competitionService.getPredictions(this.userId, this.competitionCode, matchIds).subscribe(preds => {
        this.predictions = {};
        for (const p of preds) {
          this.predictions[p.matchId] = p;
        }
        this.cdr.detectChanges();
      });
    }
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

  createLeague() {
    if (!this.newLeagueName.trim() || !this.competitionCode || !this.userId) return;
    
    this.isCreatingLeague = true;
    this.predictionLeagueService.createPredictionLeague(this.competitionCode, this.userId, this.newLeagueName.trim())
      .subscribe({
        next: (newLeague) => {
          this.isCreatingLeague = false;
          this.newLeagueName = '';
          this.loadLeagues();
          this.router.navigate(['/competition', this.competitionCode, 'league', newLeague.id]);
        },
        error: () => {
          this.isCreatingLeague = false;
        }
      });
  }

  get filteredMatches() {
    return this.matches.filter(m => m.matchday === this.selectedMatchday);
  }

  extractTeams() {
    const teamIds = new Set<number>();
    for (const match of this.matches) {
      if (match.homeTeamId) {
        teamIds.add(match.homeTeamId);
      }
      if (match.awayTeamId) {
        teamIds.add(match.awayTeamId);
      }
    }

    if (teamIds.size > 0) {
      const requests = Array.from(teamIds).map(id => this.teamService.getTeamDetails(id).pipe(catchError(() => of(null))));
      forkJoin(requests).subscribe(teams => {
        this.teams = teams.filter(t => t !== null).sort((a: any, b: any) => a.name.localeCompare(b.name));
        this.cdr.detectChanges();
      });
    }
  }

  onPredictionChanged(matchId: number, predictionData: any) {
    if (!this.userId || !this.competitionCode) return;
    
    const oldPrediction = this.predictions[matchId];
    const oldPowerup = oldPrediction ? oldPrediction.powerup : null;
    const newPowerup = predictionData.powerup;
    const newDoubleScorerId = predictionData.doubleScorerId || 0;

    const powerupChanged = oldPowerup !== newPowerup;
    const doubleScorerChanged = newPowerup === 'doubleScorer' && this.currentMatchdayPowerups.doubleScorerId !== newDoubleScorerId;

    if (powerupChanged || doubleScorerChanged) {
      // Create a new object reference to ensure Angular change detection pushes the update to all child tiles
      const updatedPowerups = { ...this.currentMatchdayPowerups };

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

      this.currentMatchdayPowerups = updatedPowerups;
      
      if (this.powerupsData && this.powerupsData.matchdays) {
        const mdIndex = this.powerupsData.matchdays.findIndex((m: any) => m.matchdayNumber === this.selectedMatchday);
        if (mdIndex > -1) {
          this.powerupsData.matchdays[mdIndex] = updatedPowerups;
        }
      }

      this.competitionService.savePowerups(this.userId, this.competitionCode, this.powerupsData).subscribe();
      this.cdr.detectChanges();
    }

    const prediction = {
      ...oldPrediction,
      matchId: matchId,
      userId: parseInt(this.userId, 10),
      homeScore: predictionData.homeScore,
      awayScore: predictionData.awayScore,
      scorerId: predictionData.scorerId,
      powerup: predictionData.powerup
    };

    // Eagerly update locally to block duplicate toggles synchronously while API call processes
    this.predictions[matchId] = prediction;

    this.competitionService.savePrediction(this.userId, this.competitionCode, matchId, prediction as any).subscribe(res => {
      res.powerup = prediction.powerup; // preserve the field locally in case backend drops it
      this.predictions[matchId] = res;
    });
  }

  prevMatchday() {
    if (this.selectedMatchday > 1) {
      this.selectedMatchday--;
      this.updateCurrentMatchdayPowerups();
    }
  }

  nextMatchday() {
    this.selectedMatchday++;
    this.updateCurrentMatchdayPowerups();
  }
}
