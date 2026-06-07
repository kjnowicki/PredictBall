import { Component, Inject, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  styleUrls: ['./login.page.css']
})
export class LoginPage {
  loginData = { username: '', password: '' };
  registerData = { displayName: '', username: '', password: '' };

  private breakpointObserver = inject(BreakpointObserver);

  isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 719.98px)').pipe(
      map(result => result.matches)
    ),
    { initialValue: false }
  );

  constructor(
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  onLogin() {
    // TODO: Connect this to your authentication service
    console.log('Logging in...', this.loginData);
    
    this.handleSuccessfulAuth();
  }

  onRegister() {
    // TODO: Connect this to your user registration service
    console.log('Registering...', this.registerData);
    
    this.handleSuccessfulAuth();
  }

  private handleSuccessfulAuth() {
    // Set cookie that expires in 1 day (86400 seconds)
    this.document.cookie = 'isAuthenticated=true; path=/; max-age=86400; SameSite=Strict';
    this.router.navigate(['/home']);
  }
}
