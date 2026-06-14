import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatchService } from '../services/match.service';
import { Team } from '../models/team';
import { Match } from '../models';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface TeamSelectData {
  competitionCode?: string;
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
}

interface PlayerStat {
  id: number;
  name: string;
  position: string;
  minutesPlayed: number;
  goals: number;
}

@Component({
  selector: 'app-team-select',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './team-select.html',
  styleUrl: './team-select.css',
})
export class TeamSelect implements OnInit {
  homePlayers: PlayerStat[] = [];
  awayPlayers: PlayerStat[] = [];
  displayedColumns: string[] = ['position', 'name', 'minutesPlayed', 'goals'];
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<TeamSelect>,
    @Inject(MAT_DIALOG_DATA) public data: TeamSelectData,
    private matchService: MatchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loading = true;
    if (!this.data.competitionCode) {
      this.homePlayers = this.calculateStats(this.data.homeTeam, [], []);
      this.awayPlayers = this.calculateStats(this.data.awayTeam, [], []);
      this.loading = false;
      return;
    }

    this.matchService.getMatchSchedule(this.data.competitionCode).subscribe({
      next: schedule => {
        const getTeamId = (team: any) => team?.id || team?.teamId;
        const homeId = getTeamId(this.data.homeTeam);
        const awayId = getTeamId(this.data.awayTeam);

        const pastMatches = schedule.filter(m => 
          (m.homeTeamId === homeId || m.awayTeamId === homeId ||
           m.homeTeamId === awayId || m.awayTeamId === awayId) &&
          (m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'LIVE')
        );

        const requests = pastMatches.map(m => 
          this.matchService.getMatchDetails(m.id.toString())
            .pipe(catchError(() => of(null)))
        );

        if (requests.length === 0) {
          this.homePlayers = this.calculateStats(this.data.homeTeam, pastMatches, []);
          this.awayPlayers = this.calculateStats(this.data.awayTeam, pastMatches, []);
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        forkJoin(requests).subscribe(detailsArray => {
          const validMatches: Match[] = [];
          detailsArray.forEach((details, index) => {
            if (details) {
              validMatches.push({ ...pastMatches[index], matchDetails: details });
            }
          });
          this.homePlayers = this.calculateStats(this.data.homeTeam, pastMatches, validMatches);
          this.awayPlayers = this.calculateStats(this.data.awayTeam, pastMatches, validMatches);
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.homePlayers = this.calculateStats(this.data.homeTeam, [], []);
        this.awayPlayers = this.calculateStats(this.data.awayTeam, [], []);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private getShortPos(pos: string): string {
    if (!pos) return '';
    const p = pos.toLowerCase();
    if (p.includes('goalkeeper')) return 'GK';
    if (p.includes('defen')) return 'DEF';
    if (p.includes('midfiel')) return 'MID';
    if (p.includes('offen') || p.includes('attack') || p.includes('forward')) return 'FWD';
    return pos;
  }

  private getPosOrder(pos: string): number {
    if (pos === 'GK') return 1;
    if (pos === 'DEF') return 2;
    if (pos === 'MID') return 3;
    if (pos === 'FWD') return 4;
    return 99;
  }

  calculateStats(team: Team | undefined, scheduleMatches: Match[], detailedMatches: Match[]): PlayerStat[] {
    if (!team) return [];
    const teamId = team.id || (team as any).teamId;
    if (!teamId) return [];
    const statsMap = new Map<number, PlayerStat>();

    team.squad?.forEach(p => {
       statsMap.set(p.id, { id: p.id, name: p.name, position: this.getShortPos(p.position || ''), minutesPlayed: 0, goals: 0 });
    });

    // Fallback to current match's lineups if squad is empty
    if (this.data.match?.matchDetails) {
      const isHome = this.data.match.homeTeamId === teamId;
      const isAway = this.data.match.awayTeamId === teamId;
      if (isHome || isAway) {
        const lineup = isHome ? this.data.match.matchDetails.homeLineup?.players : this.data.match.matchDetails.awayLineup?.players;
        const bench = isHome ? this.data.match.matchDetails.homeBench?.players : this.data.match.matchDetails.awayBench?.players;
        [...(lineup || []), ...(bench || [])].forEach(p => {
          if (!statsMap.has(p.id)) {
            statsMap.set(p.id, { id: p.id, name: p.name, position: this.getShortPos(p.position || ''), minutesPlayed: 0, goals: 0 });
          }
        });
      }
    }

    const processedGoalMatches = new Set<number>();

    const processGoals = (m: Match, teamLineup: any[], teamBench: any[]) => {
      if (processedGoalMatches.has(m.id)) return;
      if (!m.matchDetails?.scorers || m.matchDetails.scorers.length === 0) {
        processedGoalMatches.add(m.id);
        return;
      }

      const isHome = m.homeTeamId === teamId;
      const isAway = m.awayTeamId === teamId;
      if (!isHome && !isAway) return;

      m.matchDetails.scorers.forEach(scorer => {
        if (statsMap.has(scorer.id)) {
          statsMap.get(scorer.id)!.goals += 1;
        } else {
          // Fallback: Verify the scorer actually belongs to the current team iteration to avoid opponent pollution
          const inTeamMatchSquad = [...(teamLineup || []), ...(teamBench || [])].some(p => p.id === scorer.id);
          const inTeamSquad = team.squad?.some(p => p.id === scorer.id);
          
          if (inTeamMatchSquad || inTeamSquad) {
            const fallbackPos = team.squad?.find(p => p.id === scorer.id)?.position || '';
            statsMap.set(scorer.id, { id: scorer.id, name: scorer.name, position: this.getShortPos(fallbackPos), minutesPlayed: 0, goals: 1 });
          }
        }
      });
      processedGoalMatches.add(m.id);
    };

    detailedMatches.forEach(m => {
      if (!m.matchDetails) return;
      const isHome = m.homeTeamId === teamId;
      const isAway = m.awayTeamId === teamId;
      if (!isHome && !isAway) return;

      const teamLineup = isHome ? m.matchDetails.homeLineup?.players : m.matchDetails.awayLineup?.players;
      const teamBench = isHome ? m.matchDetails.homeBench?.players : m.matchDetails.awayBench?.players;
      const substitutions = m.matchDetails.substitutions || [];

      processGoals(m, teamLineup || [], teamBench || []);

      let matchDuration = 90;
      const maxSubMinute = substitutions.reduce((max, s) => Math.max(max, s.minute), 0);
      if (maxSubMinute > 90) matchDuration = 120;

      teamLineup?.forEach(p => {
        if (!statsMap.has(p.id)) statsMap.set(p.id, { id: p.id, name: p.name, position: this.getShortPos(p.position || ''), minutesPlayed: 0, goals: 0 });
        const stat = statsMap.get(p.id)!;
        
        const subOut = substitutions.find(s => s.playerOut?.id === p.id && s.teamId === teamId);
        if (subOut) stat.minutesPlayed += subOut.minute;
        else stat.minutesPlayed += matchDuration;
      });

      substitutions.forEach(s => {
        if (s.teamId === teamId && s.playerIn) {
          if (!statsMap.has(s.playerIn.id)) {
            const benchPlayer = teamBench?.find(p => p.id === s.playerIn.id);
            const fallbackPos = benchPlayer?.position || team.squad?.find(p => p.id === s.playerIn.id)?.position || '';
            statsMap.set(s.playerIn.id, { id: s.playerIn.id, name: s.playerIn.name, position: this.getShortPos(fallbackPos), minutesPlayed: 0, goals: 0 });
          }
          const stat = statsMap.get(s.playerIn.id)!;
          const alsoSubbedOut = substitutions.find(so => so.playerOut?.id === s.playerIn.id && so.teamId === teamId);
          if (alsoSubbedOut) stat.minutesPlayed += (alsoSubbedOut.minute - s.minute);
          else stat.minutesPlayed += (matchDuration - s.minute);
        }
      });
    });

    scheduleMatches.forEach(m => {
      processGoals(m, [], []);
    });

    return Array.from(statsMap.values()).sort((a, b) => 
      this.getPosOrder(a.position) - this.getPosOrder(b.position) || b.goals - a.goals || b.minutesPlayed - a.minutesPlayed || a.name.localeCompare(b.name)
    );
  }

  selectPlayer(player: PlayerStat) {
    this.dialogRef.close(player.id);
  }
}
