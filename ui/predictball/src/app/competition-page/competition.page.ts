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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { PredictionTileComponent } from '../prediction-tile-component/prediction.tile.component';
import { CompetitionService } from '../services/competition.service';
import { PredictionLeagueService } from '../services/prediction-league.service';
import { MatchService } from '../services/match.service';
import { TeamService } from '../services/team.service';
import { ScoringSystemService } from '../services/scoring-system.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Match, ScoringSystem } from '../models';
import { Competition } from '../models/competition';
import { calculatePredictionPoints } from '../utils/scoring.utils';

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
    MatTooltipModule,
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
  private _selectedMatchday: any = 1;
  get selectedMatchday(): any {
    return this._selectedMatchday;
  }
  set selectedMatchday(val: any) {
    if (this._selectedMatchday !== val) {
      this._selectedMatchday = val;
      this.modifyingCount = 0;
    }
  }
  matchdaySteps: (number | string)[] = [];
  powerupsData: any = null;
  currentMatchdayPowerups: any = { matchdayNumber: 1, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
  scoringSystem: ScoringSystem = {
    "scorer": 10,
    "goalDif": 2,
    "teamGoals": 2,
    "exactScore": 5,
    "result": 3,
    "bothScorers": 5
  };
  currentTime: Date = new Date();
  timeZoneString: string = '';
  private timeInterval: any;
  
  modifyingCount = 0;
  activeRequests = 0;

  publicLeagues: PublicLeague[] = [];
  yourLeagues: PublicLeague[] = [];
  joinCode: string = '';
  newLeagueName: string = '';
  isCreatingLeague: boolean = false;
  userId: string | null = null;
  viewedUserId: string | null = null;
  viewedUserName: string | null = null;
  private lastLoadedUserId: string | null = null;
  
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

  enrichMatches() {
    if (!this.competitionCode) return;
    const matchesToEnrich = this.filteredMatches.filter(m => m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED');
    
    if (matchesToEnrich.length > 0) {
      const requests = matchesToEnrich.map(m => 
        this.matchService.getMatch(this.competitionCode!, m.id.toString()).pipe(catchError(() => of(null)))
      );
      
      forkJoin(requests).subscribe({
        next: updatedMatches => {
          let changed = false;
          updatedMatches.forEach(updated => {
            if (updated) {
              const index = this.matches.findIndex(x => x.id === updated.id);
              if (index !== -1) {
                const m = { ...this.matches[index] };
                m.status = updated.status;
                m.matchDetails = updated.matchDetails;
                this.matches[index] = m;
                changed = true;
              }
            }
          });
          if (changed) {
            this.matches = [...this.matches]; // Reassign array to trigger ngOnChanges in child tiles
            this.cdr.detectChanges();
          }
        },
        error: err => console.error('Error enriching matches:', err)
      });
    }
  }

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

      const cookies = this.document.cookie.split(';');
      for (const cookie of cookies) {
        const [key, value] = cookie.split('=', 2).map(c => c.trim());
        if (key === 'userId') {
          this.userId = value ? decodeURIComponent(value).replace(/^"|"$/g, '') : null;
          break;
        }
      }
    }

    if (this.userId == undefined || this.userId == null) {
      console.warn('User is not authenticated.');
    }

    this.scoringSystemService.getScoringSystem().subscribe({
      next: sys => {
        this.scoringSystem = sys;
        this.cdr.detectChanges();
      },
      error: err => console.error('Error fetching scoring system:', err)
    });

    this.route.queryParamMap.subscribe(queryParams => {
      this.viewedUserId = queryParams.get('viewUser');
      this.viewedUserName = queryParams.get('viewUserName');

      const matchdayParam = queryParams.get('matchday');
      if (matchdayParam) {
        const mdNum = parseInt(matchdayParam, 10);
        this.selectedMatchday = isNaN(mdNum) ? matchdayParam : mdNum;
        this.updateCurrentMatchdayPowerups();
      }

      const targetUserId = this.viewedUserId || this.userId;
      if (targetUserId && targetUserId !== this.lastLoadedUserId) {
        this.lastLoadedUserId = targetUserId;
        this.loadPowerups();
        this.loadPredictions();
      }
    });

    this.route.paramMap.subscribe(params => {
      this.competitionCode = params.get('id');
      if (this.competitionCode) {
        forkJoin({
          comp: this.competitionService.getCompetition(this.competitionCode),
          matches: this.matchService.getMatchSchedule(this.competitionCode)
        }).subscribe({
          next: ({ comp, matches }) => {
            this.competitionName = comp.name;
            this.competition = comp;
            this.matches = matches;

            // Extract unique matchdays and stages sorted chronologically by earliest match start time
            const groups: { [key: string]: { key: number | string, earliestTime: number } } = {};
            matches.forEach(m => {
              const key = m.matchday > 0 ? m.matchday : m.stage;
              if (!key) return;
              const time = new Date(m.startTime).getTime();
              if (!groups[key]) {
                groups[key] = { key, earliestTime: time };
              } else if (time < groups[key].earliestTime) {
                groups[key].earliestTime = time;
              }
            });
            const sortedGroups = Object.values(groups).sort((a, b) => a.earliestTime - b.earliestTime);
            this.matchdaySteps = sortedGroups.map(g => g.key);

            const matchdayParam = this.route.snapshot.queryParamMap.get('matchday');
            if (matchdayParam) {
              const mdNum = parseInt(matchdayParam, 10);
              this.selectedMatchday = isNaN(mdNum) ? matchdayParam : mdNum;
            }

            if (!matchdayParam || !this.matchdaySteps.includes(this.selectedMatchday)) {
              const currentMd = comp.currentSeason?.currentMatchday;
              if (currentMd && this.matchdaySteps.includes(currentMd)) {
                this.selectedMatchday = currentMd;
              } else {
                const unfinishedGroup = this.matchdaySteps.find(step => {
                  const groupMatches = this.matches.filter(m => (m.matchday > 0 ? m.matchday : m.stage) === step);
                  return groupMatches.some(m => m.status !== 'FINISHED');
                });
                this.selectedMatchday = unfinishedGroup || this.matchdaySteps[0] || 1;
              }
            }

            this.extractTeams();
            this.enrichMatches();

            this.loadPowerups();
            this.loadPredictions();
            this.loadLeagues();

            this.cdr.detectChanges();
          },
          error: err => console.error('Error fetching competition data:', err)
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  loadPowerups() {
    if (this.competition && this.competition.id && this.userId) {
      const targetUserId = this.viewedUserId || this.userId;
      this.lastLoadedUserId = targetUserId;
      this.competitionService.getPowerups(targetUserId, this.competition.id.toString()).subscribe({
        next: data => {
          if (!data || !data.season) {
            data = { season: this.competition?.currentSeason?.startDate?.substring(0, 4) || '2024', matchdays: [] };
          }
          this.powerupsData = data;
          this.updateCurrentMatchdayPowerups();
        },
        error: err => console.error('Error loading powerups:', err)
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
    if (this.competition && this.competition.id && this.userId && this.matches.length > 0) {
      const matchIds = this.matches.map(m => m.id);
      const targetUserId = this.viewedUserId || this.userId;
      this.lastLoadedUserId = targetUserId;
      this.competitionService.getPredictions(targetUserId, this.competition.id.toString(), matchIds).subscribe({
        next: preds => {
          this.predictions = {};
          if (preds && Array.isArray(preds)) {
            for (const p of preds) {
              this.predictions[p.matchId] = p;
            }
          }
          this.cdr.detectChanges();
        },
        error: err => console.error('Error loading predictions:', err)
      });
    }
  }

  loadLeagues() {
    if (this.competition && this.competition.id && this.userId) {
      this.predictionLeagueService.getCompetitionLeagues(this.competition.id.toString(), this.userId).subscribe({
        next: res => {
          this.publicLeagues = res.publicLeagues;
          this.yourLeagues = res.yourLeagues;
          this.cdr.detectChanges();
        },
        error: err => console.error('Error loading leagues:', err)
      });
    }
  }

  joinLeague() {
    if (!this.joinCode.trim() || !this.competition || !this.competition.id || !this.userId) return;
    this.predictionLeagueService.joinLeagueByCode(this.competition.id.toString(), this.userId, this.joinCode.trim()).subscribe({
      next: () => {
        this.joinCode = '';
        this.loadLeagues();
        this.cdr.detectChanges();
      },
      error: err => console.error('Error joining league:', err)
    });
  }

  createLeague() {
    if (!this.newLeagueName.trim() || !this.competition || !this.competition.id || !this.userId) return;
    
    this.isCreatingLeague = true;
    this.predictionLeagueService.createPredictionLeague(this.competition.id.toString(), this.userId, this.newLeagueName.trim())
      .subscribe({
        next: (newLeague) => {
          this.isCreatingLeague = false;
          this.newLeagueName = '';
          this.loadLeagues();
          this.cdr.detectChanges();
          this.router.navigate(['/competition', this.competitionCode, 'league', newLeague.id]).catch(err => console.error('Navigation error:', err));
        },
        error: () => {
          this.isCreatingLeague = false;
          this.cdr.detectChanges();
        }
      });
  }

  get filteredMatches() {
    return this.matches.filter(m => (m.matchday > 0 ? m.matchday : m.stage) === this.selectedMatchday);
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

  onTileModifying(isModifying: boolean) {
    setTimeout(() => {
      if (isModifying) {
        this.modifyingCount++;
      } else {
        this.modifyingCount = Math.max(0, this.modifyingCount - 1);
      }
      this.cdr.detectChanges();
    }, 0);
  }

  onPredictionChanged(matchId: number, predictionData: any) {
    if (!this.userId || !this.competition || !this.competition.id) return;
    
    const match = this.matches.find(m => m.id === matchId);
    const matchdayKey = match ? (match.matchday > 0 ? match.matchday : match.stage) : this.selectedMatchday;

    let targetMatchdayPowerups = this.powerupsData?.matchdays?.find((m: any) => m.matchdayNumber === matchdayKey);
    if (!targetMatchdayPowerups && this.powerupsData) {
      targetMatchdayPowerups = { matchdayNumber: matchdayKey, doubleScorerMatchId: 0, doubleScorerId: 0, tripleScoreMatchId: 0, reversalMatchId: 0 };
      this.powerupsData.matchdays.push(targetMatchdayPowerups);
    }

    const oldPrediction = this.predictions[matchId];
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
      // Create a new object reference to ensure Angular change detection pushes the update to all child tiles
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

      if (matchdayKey === this.selectedMatchday) {
        this.currentMatchdayPowerups = updatedPowerups;
      }
      
      if (this.powerupsData && this.powerupsData.matchdays) {
        const mdIndex = this.powerupsData.matchdays.findIndex((m: any) => m.matchdayNumber === matchdayKey);
        if (mdIndex > -1) {
          this.powerupsData.matchdays[mdIndex] = updatedPowerups;
        }
      }

      this.competitionService.savePowerups(this.userId, this.competition.id.toString(), this.powerupsData).subscribe({
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

    // Eagerly update locally to block duplicate toggles synchronously while API call processes
    this.predictions[matchId] = prediction;

    setTimeout(() => {
      this.activeRequests++;
      this.cdr.detectChanges();

      this.competitionService.savePrediction(this.userId!, this.competition!.id!.toString(), matchId, prediction as any).subscribe({
        next: (res) => {
          res.powerup = prediction.powerup; // preserve the field locally in case backend drops it
          this.predictions[matchId] = res;
          this.activeRequests = Math.max(0, this.activeRequests - 1);
          this.cdr.detectChanges();
        },
        error: () => {
          this.activeRequests = Math.max(0, this.activeRequests - 1);
          this.cdr.detectChanges();
        }
      });
    }, 0);
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

  prevMatchday() {
    const idx = this.matchdaySteps.indexOf(this.selectedMatchday);
    if (idx > 0) {
      this.selectedMatchday = this.matchdaySteps[idx - 1];
      this.updateCurrentMatchdayPowerups();
      this.enrichMatches();
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { matchday: this.selectedMatchday },
        queryParamsHandling: 'merge'
      });
    }
  }

  nextMatchday() {
    const idx = this.matchdaySteps.indexOf(this.selectedMatchday);
    if (idx !== -1 && idx < this.matchdaySteps.length - 1) {
      this.selectedMatchday = this.matchdaySteps[idx + 1];
      this.updateCurrentMatchdayPowerups();
      this.enrichMatches();
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { matchday: this.selectedMatchday },
        queryParamsHandling: 'merge'
      });
    }
  }

  clearViewUser() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { viewUser: null, viewUserName: null },
      queryParamsHandling: 'merge'
    });
  }

  get completedPredictions() {
    let count = 0;
    for (const m of this.filteredMatches) {
      const p = this.predictions[m.id];
      if (!p) continue;
      
      const homeScore = p.homeScore;
      const awayScore = p.awayScore;
      
      const areScoresSet = homeScore !== null && homeScore !== undefined && 
                           awayScore !== null && awayScore !== undefined && 
                           homeScore !== '' && awayScore !== '';
                           
      if (areScoresSet) {
        const isDrawZero = (Number(homeScore) + Number(awayScore) === 0);
        const isScorerSelected = !!p.scorerId && p.scorerId !== 0;
        
        if (isDrawZero || isScorerSelected) {
          count++;
        }
      }
    }
    return count;
  }

  calculatePointsForPrediction(match: Match, prediction: any): number {
    const result = calculatePredictionPoints(match, this.scoringSystem, prediction);
    return result ? result.totalPoints : 0;
  }

  get maxMatchesPerMatchday(): number {
    if (!this.matches || this.matches.length === 0) return 0;
    const counts: Record<string, number> = {};
    this.matches.forEach(m => {
      const key = m.matchday > 0 ? m.matchday.toString() : m.stage;
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    const values = Object.values(counts);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  get currentMatchdayMultiplier(): number {
    const numMatches = this.filteredMatches.length;
    if (numMatches === 0) return 1;
    const N = this.maxMatchesPerMatchday;
    if (numMatches === 1) return 4;
    if (numMatches >= 2 && numMatches <= 4) return 3;
    if (numMatches >= 5 && numMatches <= Math.floor(N / 2)) return 2;
    return 1;
  }

  get rawMatchdayScore() {
    let total = 0;
    for (const match of this.filteredMatches) {
      const p = this.predictions[match.id];
      if (p) {
        let powerup = p.powerup || null;
        let doubleScorerId = p.doubleScorerId || null;

        if (this.currentMatchdayPowerups) {
          if (this.currentMatchdayPowerups.doubleScorerMatchId === match.id) {
            powerup = 'doubleScorer';
            doubleScorerId = this.currentMatchdayPowerups.doubleScorerId || 0;
          } else if (this.currentMatchdayPowerups.tripleScoreMatchId === match.id) {
            powerup = 'tripleScore';
          } else if (this.currentMatchdayPowerups.reversalMatchId === match.id) {
            powerup = 'reversal';
          }
        }

        if (powerup === 'tripleScore' && this.currentMatchdayMultiplier > 1) {
          powerup = null;
        }
        if (powerup === 'reversal' && this.filteredMatches.length <= 2) {
          powerup = null;
        }

        const enrichedPrediction = {
          ...p,
          powerup,
          doubleScorerId
        };

        total += this.calculatePointsForPrediction(match, enrichedPrediction);
      }
    }
    return total;
  }

  get matchdayScore() {
    return this.rawMatchdayScore * this.currentMatchdayMultiplier;
  }

}
