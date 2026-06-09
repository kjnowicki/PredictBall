import { Component, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Match } from '../models';
import { TeamService } from '../services/team.service';
import { Team } from '../models/team';
import { forkJoin } from 'rxjs';

interface ScorerOption {
  id: number;
  name: string;
  code: string;
  teamName: string;
}

interface ScorerGroup {
  name: string;
  scorers: ScorerOption[];
}

@Component({
  selector: 'app-prediction-tile',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './prediction.tile.component.html',
  styleUrl: './prediction.tile.component.css',
})
export class PredictionTileComponent implements OnInit {
  @Input() match!: Match;

  private teamService = inject(TeamService);
  private cdr = inject(ChangeDetectorRef);

  homeTeam?: Team;
  awayTeam?: Team;
  homeGoalsPrediction: number | null = null;
  awayGoalsPrediction: number | null = null;
  scorerGroups: ScorerGroup[] = [];
  selectedScorer: number | null = null;
  scoredPoints: number | null = null;

  isPast: boolean = false;
  isLive: boolean = false;

  ngOnInit() {
    if (this.match) {
      this.checkStatus();
      this.loadData();
    }
  }

  checkStatus() {
    const start = new Date(this.match.startTime);
    this.isPast = start.getTime() < Date.now();
    this.isLive = this.match.status === 'IN_PLAY' || this.match.status === 'PAUSED';
  }

  loadData() {
    forkJoin({
      home: this.teamService.getTeamDetails(this.match.homeTeamId),
      away: this.teamService.getTeamDetails(this.match.awayTeamId)
    }).subscribe(({ home, away }) => {
      this.homeTeam = home;
      this.awayTeam = away;

      const homePlayers = this.match.matchDetails?.homeLineup?.players?.length 
        ? this.match.matchDetails.homeLineup.players 
        : (home.squad || []);
      const awayPlayers = this.match.matchDetails?.awayLineup?.players?.length 
        ? this.match.matchDetails.awayLineup.players 
        : (away.squad || []);

      const groupsMap = new Map<string, ScorerGroup>();

      const addPlayersToGroup = (players: any[], teamName: string, teamCode: string) => {
        if (!groupsMap.has(teamName)) {
          groupsMap.set(teamName, { name: teamName, scorers: [] });
        }
        players.forEach((p: any) => {
          groupsMap.get(teamName)!.scorers.push({
            id: p.id,
            name: p.name,
            code: teamCode,
            teamName: teamName
          });
        });
      };

      const homeName = home.name || 'Home';
      const awayName = away.name || 'Away';
      const homeCode = home.tla || home.shortName || homeName;
      const awayCode = away.tla || away.shortName || awayName;

      addPlayersToGroup(homePlayers, homeName, homeCode);
      addPlayersToGroup(awayPlayers, awayName, awayCode);

      this.scorerGroups = Array.from(groupsMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      this.scorerGroups.forEach(group => {
        group.scorers.sort((a, b) => a.name.localeCompare(b.name));
      });

      this.cdr.detectChanges();
    });
  }

  getFlagEmoji(teamName: string): string {
    const flags: Record<string, string> = {
      'Argentina': '🇦🇷', 'Australia': '🇦🇺', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
      'Brazil': '🇧🇷', 'Cameroon': '🇨🇲', 'Canada': '🇨🇦', 'Colombia': '🇨🇴',
      'Costa Rica': '🇨🇷', 'Croatia': '🇭🇷', 'Czech Republic': '🇨🇿', 'Denmark': '🇩🇰',
      'Ecuador': '🇪🇨', 'Egypt': '🇪🇬', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France': '🇫🇷',
      'Germany': '🇩🇪', 'Ghana': '🇬🇭', 'Iran': '🇮🇷', 'Italy': '🇮🇹',
      'Ivory Coast': '🇨🇮', 'Japan': '🇯🇵', 'Mexico': '🇲🇽', 'Morocco': '🇲🇦',
      'Netherlands': '🇳🇱', 'Nigeria': '🇳🇬', 'Norway': '🇳🇴', 'Poland': '🇵🇱',
      'Portugal': '🇵🇹', 'Qatar': '🇶🇦', 'Saudi Arabia': '🇸🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      'Senegal': '🇸🇳', 'Serbia': '🇷🇸', 'South Korea': '🇰🇷', 'Spain': '🇪🇸',
      'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Tunisia': '🇹🇳', 'United States': '🇺🇸',
      'USA': '🇺🇸', 'Uruguay': '🇺🇾', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
    };
    return flags[teamName] || '🏳️';
  }
}
