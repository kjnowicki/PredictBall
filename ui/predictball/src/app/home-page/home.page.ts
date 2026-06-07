import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PredictionTileComponent } from '../prediction-tile-component/prediction.tile.component';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

interface Competition {
  id: string;
  name: string;
  points: number;
}

interface League {
  id: string;
  name: string;
  competitionId: string;
  position: number;
}

interface Task {
  matchId: string;
  matchName: string;
  date: string;
  status: 'missing' | 'invalid';
}

@Component({
  selector: 'app-home.page',
  imports: [
    FormsModule,
    RouterLink,
    CommonModule,
    PredictionTileComponent,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage implements OnInit {
// Mock Data: Replace with actual service calls
  competitions: Competition[] = [
    { id: 'comp1', name: 'Premier League 2023/24', points: 120 },
    { id: 'comp2', name: 'Champions League 2023/24', points: 45 }
  ];

  leagues: League[] = [
    { id: 'l1', name: 'Office League', competitionId: 'comp1', position: 3 },
    { id: 'l2', name: 'Friends League', competitionId: 'comp1', position: 1 },
    { id: 'l3', name: 'Global CL', competitionId: 'comp2', position: 405 }
  ];

  tasks: Task[] = [
    { matchId: 't1', matchName: 'Arsenal vs Chelsea', date: '2023-10-21', status: 'missing' },
    { matchId: 't2', matchName: 'Real Madrid vs Bayern', date: '2023-10-24', status: 'invalid' }
  ];

  selectedCompetitionId = signal('');
  selectedTask: Task | null = null;

  leaguesDisplayedColumns: string[] = ['name', 'position'];
  tasksDisplayedColumns: string[] = ['matchName', 'date', 'status'];

  readonly dialog = inject(MatDialog);
  @ViewChild('taskDialog') taskDialog!: TemplateRef<any>;

  ngOnInit(): void {
    if (this.competitions.length > 0) {
      this.selectedCompetitionId.set(this.competitions[0].id);
    }
  }

  get currentCompetition(): Competition | undefined {
    return this.competitions.find(c => c.id === this.selectedCompetitionId());
  }

  get filteredLeagues(): League[] {
    return this.leagues.filter(l => l.competitionId === this.selectedCompetitionId());
  }

  openTaskModal(task: Task): void {
    this.selectedTask = task;
    this.dialog.open(this.taskDialog);
  }

  closeModal(): void {
    this.dialog.closeAll();
    this.selectedTask = null;
  }
}
