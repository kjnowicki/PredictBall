import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'app-top-navigation',
  imports: [RouterLink, RouterLinkActive, MatTabsModule],
  templateUrl: './top-navigation.html',
  styleUrl: './top-navigation.css',
})
export class TopNavigation {

}
