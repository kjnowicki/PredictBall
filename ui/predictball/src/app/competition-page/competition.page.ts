import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
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
  imports: [CommonModule, MatCardModule, MatTabsModule, MatTableModule, RouterModule],
  templateUrl: './competition.page.html',
  styleUrl: './competition.page.css',
})
export class CompetitionPage implements OnInit {
  competitionId: string | null = null;
  competitionName: string = '';
  matches: Match[] = [];
  
  publicLeagues: PublicLeague[] = [
    { id: 'l3', name: 'Global CL', participants: 10542 },
    { id: 'l4', name: 'UK Fans', participants: 523 }
  ];
  
  leaguesDisplayedColumns: string[] = ['name', 'participants'];

  constructor(
    private route: ActivatedRoute,
    private competitionService: CompetitionService,
    private matchService: MatchService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.competitionId = params.get('id');
      if (this.competitionId) {
        this.competitionService.getCompetition(Number(this.competitionId)).subscribe(comp => {
          this.competitionName = comp.name;
        });
        this.matchService.getMatchSchedule(this.competitionId).subscribe(matches => {
          this.matches = matches;
        });
      }
    });
  }
}
