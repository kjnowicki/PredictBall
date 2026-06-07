import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

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
export class ProfilePage {
  activeTab = signal<'password' | 'displayName' | 'delete'>('password');

  passwordData = { oldPassword: '', newPassword: '', confirmPassword: '' };
  displayNameData = { newDisplayName: '' };
  deleteData = { confirmPassword: '' };

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
