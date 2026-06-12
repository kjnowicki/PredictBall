import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User, UserLeagues } from '../models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private api = inject(ApiService);

  getUser(userId: string): Observable<User> {
    return this.api.get<User>(`user/${userId}`);
  }

  createUser(user: User): Observable<User> {
    return this.api.put<User>('user', user);
  }

  authenticateUser(credentials: Partial<User>): Observable<User> {
    return this.api.post<User>('user/authenticate', credentials);
  }

  getYourLeagues(userId: string): Observable<UserLeagues> {
    return this.api.get<UserLeagues>(`user/${userId}/leagues`);
  }

  changePassword(userId: string, oldPassword: string, newPassword: string): Observable<any> {
    return this.api.put(`user/${userId}/password`, { oldPassword, newPassword });
  }

  updateDisplayName(userId: string, displayName: string): Observable<any> {
    return this.api.put(`user/${userId}/display-name`, { displayName });
  }

  deleteUser(userId: string, password: string): Observable<any> {
    return this.api.post(`user/${userId}/delete`, { password });
  }
}