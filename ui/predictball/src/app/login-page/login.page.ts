import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  imports: [FormsModule],
  styleUrls: ['./login.page.css']
})
export class LoginPage {
  loginData = { username: '', password: '' };
  registerData = { displayName: '', username: '', password: '' };

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
