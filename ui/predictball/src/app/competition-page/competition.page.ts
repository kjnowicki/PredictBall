import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PredictionTileComponent } from '../prediction-tile-component/prediction.tile.component';
import { CompetitionService } from '../services/competition.service';
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
  
  publicLeagues: PublicLeague[] = [
    { id: 'l3', name: 'Global CL', participants: 10542 },
    { id: 'l4', name: 'UK Fans', participants: 523 }
  ];
  
  leaguesDisplayedColumns: string[] = ['name', 'participants'];

  constructor(
    private route: ActivatedRoute,
    private competitionService: CompetitionService,
    private matchService: MatchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
      }
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
