import { Component, Inject, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    MatButtonModule,
    MatSnackBarModule
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
  private snackBar = inject(MatSnackBar);

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
        this.snackBar.open('Logged in successfully!', 'Close', { duration: 3000 });
        this.handleSuccessfulAuth(user.id);
      },
      error: (err) => {
        console.error('Login failed', err);
        const msg = err.status === 0
          ? 'Unable to connect to the authentication server. Please try again later.'
          : (err.error?.error || err.error?.message || 'Invalid username or password. Please try again.');
        this.loginError = msg;
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      }
    });
  }

  onRegister() {
    this.registerError = null;

    if(this.registerData.username.length < 5 || this.registerData.username.length > 32) {
      this.registerError = 'Username must be from 5 to 32 characters long';
      this.snackBar.open(this.registerError, 'Close', { duration: 4000 });
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(this.registerData.username)) {
      this.registerError = 'Username can only contain letters and numbers';
      this.snackBar.open(this.registerError, 'Close', { duration: 4000 });
      return;
    }

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.registerError = 'Passwords do not match.';
      this.snackBar.open(this.registerError, 'Close', { duration: 4000 });
      return;
    }

    const { confirmPassword, ...userPayload } = this.registerData;

    this.userService.createUser(userPayload as any).subscribe({
      next: (user) => {
        console.log('Registered...', user);
        this.snackBar.open('Registered successfully!', 'Close', { duration: 3000 });
        this.handleSuccessfulAuth(user.id);
      },
      error: (err) => {
        console.error('Registration failed', err);
        const msg = err.status === 0
          ? 'Unable to connect to the authentication server. Please try again later.'
          : (err.error?.error || err.error?.message || 'Registration failed. Please try again.');
        this.registerError = msg;
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      }
    });
  }

  private handleSuccessfulAuth(userId: number | string) {
    // Set cookie that expires in 1 day (86400 seconds)
    this.document.cookie = 'isAuthenticated=true; path=/; max-age=86400; SameSite=Lax';
    this.document.cookie = `userId=${userId}; path=/; max-age=86400; SameSite=Lax`;
    this.router.navigate(['/home']);
  }
}
