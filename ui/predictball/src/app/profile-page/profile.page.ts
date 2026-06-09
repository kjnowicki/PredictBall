import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const cookies = this.document.cookie.split('; ');
      const userIdCookie = cookies.find(row => row.startsWith('userId='));
      const userId = userIdCookie ? userIdCookie.split('=')[1] : null;

      if (userId) {
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
    console.log('Changing password...', this.passwordData);
  }

  onChangeDisplayName() {
    console.log('Changing display name...', this.displayNameData);
  }

  onDeleteAccount() {
    console.log('Deleting account...', this.deleteData);
  }
}
