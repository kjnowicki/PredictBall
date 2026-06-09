import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';

export const authGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const document = inject(DOCUMENT);
  const router = inject(Router);

  if (isPlatformBrowser(platformId)) {
    // Safely parse cookies from the document
    const cookies = document.cookie.split('; ');
    const authCookie = cookies.find(row => row.startsWith('isAuthenticated='));
    const isAuthenticated = authCookie ? authCookie.split('=')[1] === 'true' : false;

    return isAuthenticated ? true : router.createUrlTree(['/login']);
  }

  return true; // During Server-Side Rendering (SSR), allow initial render
};

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', canActivate: [authGuard], loadComponent: () => import('./home-page/home.page').then(m => m.HomePage) },
  { path: 'login', loadComponent: () => import('./login-page/login.page').then(m => m.LoginPage) },
  { path: 'competition/:id', canActivate: [authGuard], loadComponent: () => import('./competition-page/competition.page').then(m => m.CompetitionPage) },
  { path: 'competition/:compId/league/:id', canActivate: [authGuard], loadComponent: () => import('./league-page/league-page').then(m => m.LeaguePage) },
  { path: 'competitions', canActivate: [authGuard], loadComponent: () => import('./competitions-page/competitions-page').then(m => m.CompetitionsPage) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./profile-page/profile.page').then(m => m.ProfilePage) },
  { path: 'about', loadComponent: () => import('./about-page/about-page').then(m => m.AboutPage) },
  { path: '**', redirectTo: 'home' }
];