import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';

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
  
  publicLeagues: PublicLeague[] = [
    { id: 'l3', name: 'Global CL', participants: 10542 },
    { id: 'l4', name: 'UK Fans', participants: 523 }
  ];
  
  leaguesDisplayedColumns: string[] = ['name', 'participants'];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.competitionId = params.get('id');
      this.competitionName = `Competition ${this.competitionId}`; // Mock fetching name
    });
  }
}
