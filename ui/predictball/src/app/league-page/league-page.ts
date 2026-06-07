import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

interface Player {
  position: number;
  name: string;
  points: number;
}

@Component({
  selector: 'app-league-page',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './league-page.html',
  styleUrl: './league-page.css',
})
export class LeaguePage implements OnInit {
  leagueId: string | null = null;
  isMyLeague = false;
  joinCodeInput = '';
  leagueJoinCode = 'XYZ-123';

  players: Player[] = [
    { position: 1, name: 'Alice', points: 150 },
    { position: 2, name: 'Bob', points: 130 },
    { position: 3, name: 'Charlie', points: 110 }
  ];
  displayedColumns: string[] = ['position', 'name', 'points'];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.leagueId = params.get('id');
      // Mock determining if it's the user's league
      this.isMyLeague = this.leagueId === 'l1' || this.leagueId === 'l2';
    });
  }

  joinLeague() {
    if (this.joinCodeInput.trim()) {
      console.log(`Joining with code: ${this.joinCodeInput}`);
      // API call to join league would go here
      this.joinCodeInput = '';
    }
  }
}
