import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home-page/home.page').then(m => m.HomePage) },
  { path: 'login', loadComponent: () => import('./login-page/login.page').then(m => m.LoginPage) },
  { path: 'competition/:id', loadComponent: () => import('./competition-page/competition.page').then(m => m.CompetitionPage) },
  { path: 'competitions', loadComponent: () => import('./competitions-page/competitions-page').then(m => m.CompetitionsPage) },
  { path: 'profile', loadComponent: () => import('./profile-page/profile.page').then(m => m.ProfilePage) },
  { path: 'about', loadComponent: () => import('./about-page/about-page').then(m => m.AboutPage) },
  { path: '**', redirectTo: 'home' }
];