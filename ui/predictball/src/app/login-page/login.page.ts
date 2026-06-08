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
import { UserService } from '../services/user.service';

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
  registerData = { displayName: '', username: '', password: '', confirmPassword: '' };

  loginError: string | null = null;
  registerError: string | null = null;

  private breakpointObserver = inject(BreakpointObserver);
  private userService = inject(UserService);

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
    this.loginError = null;
    this.userService.authenticateUser(this.loginData as any).subscribe({
      next: (user) => {
        console.log('Logged in...', user);
        this.handleSuccessfulAuth(user.id);
      },
      error: (err) => {
        console.error('Login failed', err);
        this.loginError = 'Invalid username or password. Please try again.';
      }
    });
  }

  onRegister() {
    this.registerError = null;

    if (!/^[a-zA-Z]+$/.test(this.registerData.username)) {
      this.registerError = 'Username can only contain letters and no spaces.';
      return;
    }

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.registerError = 'Passwords do not match.';
      return;
    }

    const { confirmPassword, ...userPayload } = this.registerData;

    this.userService.createUser(userPayload as any).subscribe({
      next: (user) => {
        console.log('Registered...', user);
        this.handleSuccessfulAuth(user.id);
      },
      error: (err) => {
        console.error('Registration failed', err);
        this.registerError = 'Registration failed. Please try again.';
      }
    });
  }

  private handleSuccessfulAuth(userId: number | string) {
    // Set cookie that expires in 1 day (86400 seconds)
    this.document.cookie = 'isAuthenticated=true; path=/; max-age=86400; SameSite=Strict';
    this.document.cookie = `userId=${userId}; path=/; max-age=86400; SameSite=Strict`;
    this.router.navigate(['/home']);
  }
}
