import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavigation } from './top-navigation/top-navigation';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopNavigation],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('predictball');
}
