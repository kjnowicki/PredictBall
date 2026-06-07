import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavigation } from './top-navigation/top-navigation';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopNavigation],
  templateUrl: './app.html',
  styleUrl: './app.css',
  styles: [`
    .app-sidenav-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class App {
  protected readonly title = signal('predictball');
  isSidenavOpen = signal(false);
}
