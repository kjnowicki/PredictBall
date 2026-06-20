import { Component, Inject, inject, Output, EventEmitter, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-top-navigation',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatToolbarModule
  ],
  templateUrl: './top-navigation.html',
  styleUrl: './top-navigation.css',
})
export class TopNavigation {
  private breakpointObserver = inject(BreakpointObserver);
  private userService = inject(UserService);

  isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 719.98px)').pipe(
      map(result => result.matches)
    ),
    { initialValue: false }
  );

  toolbarHeight = 56; // Standard Material toolbar height on mobile

  @Output() sidenavOpenedChange = new EventEmitter<boolean>();
  @ViewChild('sidenav') sidenav?: MatSidenav;

  constructor(
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  logout() {
    this.userService.logout().subscribe({
      next: () => {
        this.clearCookiesAndRedirect();
      },
      error: (err) => {
        console.error('Logout API failed, performing fallback local logout', err);
        this.clearCookiesAndRedirect();
      }
    });
  }

  private clearCookiesAndRedirect() {
    this.document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    this.document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    this.router.navigate(['/login']);
  }

  closeSidenav() {
    this.sidenav?.close();
  }
}
