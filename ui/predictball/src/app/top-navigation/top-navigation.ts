import { Component, Inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-top-navigation',
  imports: [RouterLink, RouterLinkActive, MatTabsModule, MatIconModule, MatButtonModule],
  templateUrl: './top-navigation.html',
  styleUrl: './top-navigation.css',
})
export class TopNavigation {
  constructor(
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  logout() {
    this.document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    this.router.navigate(['/login']);
  }
}
