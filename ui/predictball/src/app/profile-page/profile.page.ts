import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-profile.page',
  imports: [
    FormsModule,
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css',
})
export class ProfilePage implements OnInit {
  activeTab = signal<'password' | 'displayName' | 'delete'>('password');

  passwordData = { oldPassword: '', newPassword: '', confirmPassword: '' };
  displayNameData = { newDisplayName: '' };
  deleteData = { confirmPassword: '' };
  currentDisplayName = '';

  private userService = inject(UserService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  userId: string | null = null;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const cookies = this.document.cookie.split('; ');
      const userIdCookie = cookies.find(row => row.startsWith('userId='));
      const userId = userIdCookie ? userIdCookie.split('=')[1] : null;

      if (userId) {
        this.userId = userId;
        this.userService.getUser(userId).subscribe({
          next: (user) => {
            this.currentDisplayName = user.displayName;
          },
          error: (err) => console.error('Error fetching user', err)
        });
      }
    }
  }

  onChangePassword() {
    if (!this.userId) return;
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    this.userService.changePassword(this.userId, this.passwordData.oldPassword, this.passwordData.newPassword).subscribe({
      next: () => {
        alert('Password changed successfully');
        this.passwordData = { oldPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => alert('Failed to change password: ' + (err.error || err.message))
    });
  }

  onChangeDisplayName() {
    if (!this.userId || !this.displayNameData.newDisplayName.trim()) return;
    this.userService.updateDisplayName(this.userId, this.displayNameData.newDisplayName).subscribe({
      next: () => {
        alert('Display name updated successfully');
        this.currentDisplayName = this.displayNameData.newDisplayName;
        this.displayNameData.newDisplayName = '';
      },
      error: (err) => alert('Failed to update display name: ' + (err.error || err.message))
    });
  }

  onDeleteAccount() {
    if (!this.userId || !this.deleteData.confirmPassword) return;
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      this.userService.deleteUser(this.userId, this.deleteData.confirmPassword).subscribe({
        next: () => {
          alert('Account deleted successfully');
          this.document.cookie = 'userId=; path=/; max-age=0;';
          this.document.cookie = 'isAuthenticated=; path=/; max-age=0;';
          this.router.navigate(['/login']);
        },
        error: (err) => alert('Failed to delete account: ' + (err.error || err.message))
      });
    }
  }
}
