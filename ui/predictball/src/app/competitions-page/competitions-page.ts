import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface Competition {
  id: string;
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

  // Mock data - replace with actual data fetching logic
  myCompetitionsData: Competition[] = [
    { id: '1', name: 'Premier League Predictions', score: 120, globalRank: 5432, playersCount: 15000, currentStage: 'Matchday 5' }
  ];

  allCompetitionsData: Competition[] = [
    { id: '1', name: 'Premier League Predictions', playersCount: 15000, currentStage: 'Matchday 5' },
    { id: '2', name: 'Champions League 24/25', playersCount: 8000, currentStage: 'Group Stage' },
    { id: '3', name: 'World Cup Qualifiers', playersCount: 5000, currentStage: 'Round 1' }
  ];

  myCompetitions = new MatTableDataSource<Competition>();
  availableCompetitions = new MatTableDataSource<Competition>();

  ngOnInit() {
    this.updateTables();
  }

  updateTables() {
    this.myCompetitions.data = this.myCompetitionsData;
    
    const myCompIds = new Set(this.myCompetitionsData.map(c => c.id));
    this.availableCompetitions.data = this.allCompetitionsData.filter(c => !myCompIds.has(c.id));
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
    // Mock join logic: Initialize with 0 score/rank
    this.myCompetitionsData.push({ ...comp, score: 0, globalRank: 0 });
    this.updateTables();
  }
}
