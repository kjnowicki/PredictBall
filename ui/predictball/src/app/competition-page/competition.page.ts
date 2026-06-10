import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
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
import { ScoringSystemService } from '../services/scoring-system.service';
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
export class CompetitionPage implements OnInit, OnDestroy {
  competitionCode: string | null = null;
  competitionName: string = '';
  competition: Competition | null = null;
  matches: Match[] = [];
  predictions: Record<number, any> = {};
  selectedMatchday: number = 1;
  powerupsData: any = null;
  currentMatchdayPowerups: any = { matchdayNumber: 1, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
  scoringSystem: any = null;
  currentTime: Date = new Date();
  timeZoneString: string = '';
  private timeInterval: any;
  
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
  private scoringSystemService = inject(ScoringSystemService);

  constructor(
    private route: ActivatedRoute,
    private competitionService: CompetitionService,
    private matchService: MatchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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

      const cookies = this.document.cookie.split('; ');
      const userIdCookie = cookies.find(row => row.startsWith('userId='));
      this.userId = userIdCookie ? userIdCookie.split('=')[1] : null;
    }

    this.scoringSystemService.getScoringSystem().subscribe(sys => {
      this.scoringSystem = sys;
      this.cdr.detectChanges();
    });

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

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
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
        if (preds && Array.isArray(preds)) {
          for (const p of preds) {
            this.predictions[p.matchId] = p;
          }
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
      this.cdr.detectChanges();
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
          this.cdr.detectChanges();
          this.router.navigate(['/competition', this.competitionCode, 'league', newLeague.id]);
        },
        error: () => {
          this.isCreatingLeague = false;
          this.cdr.detectChanges();
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
      powerup: predictionData.powerup,
      doubleScorerId: predictionData.doubleScorerId
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

  get completedPredictions() {
    return this.filteredMatches.filter(m => {
      const p = this.predictions[m.id];
      return p && p.homeScore !== null && p.awayScore !== null && p.scorerId && p.scorerId !== 0;
    }).length;
  }

  calculatePointsForPrediction(match: Match, prediction: any): number {
    if (!this.scoringSystem || !match || !prediction || !match.matchDetails || match.status !== 'FINISHED') {
      return 0;
    }

    const actualHome = match.matchDetails.homeScore;
    const actualAway = match.matchDetails.awayScore;
    let predHome = prediction.homeScore;
    let predAway = prediction.awayScore;

    if (prediction.powerup === 'reversal' && actualHome !== actualAway) {
        const actualDiff = actualHome - actualAway;
        const predDiff = predHome - predAway;
        if ((actualDiff > 0 && predDiff < 0) || (actualDiff < 0 && predDiff > 0)) {
            const temp = predHome;
            predHome = predAway;
            predAway = temp;
        }
    }

    let points = 0;
    if (actualHome === predHome && actualAway === predAway) {
      points += this.scoringSystem.scoreExact;
    } else {
      if (actualHome === predHome) points += this.scoringSystem.scoreHomeExact;
      if (actualAway === predAway) points += this.scoringSystem.scoreAwayExact;
      if (actualHome - actualAway === predHome - predAway) {
        points += this.scoringSystem.scoreDif;
      }
    }

    const actualScorers = match.matchDetails.scorers?.map((s: any) => s.id) || [];
    let scorerPoints = 0;
    if (prediction.scorerId && actualScorers.includes(prediction.scorerId)) scorerPoints += this.scoringSystem.scorer;
    if (prediction.powerup === 'doubleScorer' && prediction.doubleScorerId && actualScorers.includes(prediction.doubleScorerId)) scorerPoints += this.scoringSystem.scorer;

    points += scorerPoints;
    if (prediction.powerup === 'tripleScore') points *= 3;

    return points;
  }

  get matchdayScore() {
    let total = 0;
    for (const match of this.filteredMatches) {
      const p = this.predictions[match.id];
      if (p) {
        total += this.calculatePointsForPrediction(match, p);
      }
    }
    return total;
  }
}
