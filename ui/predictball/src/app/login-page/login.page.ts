import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  imports: [FormsModule],
  styleUrls: ['./login.page.css']
})
export class LoginPage {
  loginData = { username: '', password: '' };
  registerData = { displayName: '', username: '', password: '' };

  constructor(private router: Router) {}

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
    sessionStorage.setItem('isAuthenticated', 'true');
    this.router.navigate(['/home']);
  }
}
