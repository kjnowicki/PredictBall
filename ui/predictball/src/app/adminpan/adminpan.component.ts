import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, AdminCompetition, StatsSummary, AdminUserDetail, EndpointStat } from '../services/admin.service';

@Component({
  selector: 'app-adminpan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './adminpan.component.html',
  styleUrls: ['./adminpan.component.css']
})
export class AdminpanComponent implements OnInit {
  adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  // Auth State
  isLoggedIn = false;
  loginUsername = '';
  loginPassword = '';
  loginError = '';
  isLoggingIn = false;
  adminUsername = '';

  // Active Tab
  activeTab: 'competitions' | 'stats' | 'users' = 'competitions';

  // Competitions State
  supportedCompetitions: AdminCompetition[] = [];
  availableCompetitions: AdminCompetition[] = [];
  isLoadingCompetitions = false;
  showAddModal = false;
  competitionSearch = '';
  selectedCompForDetail: AdminCompetition | null = null;
  compDetailLoading = false;

  // Retire Season Modal
  showRetireModal = false;
  retireCompId = '';
  retireCompName = '';
  retireSeasonId = '';
  retireError = '';
  retireSuccess = '';
  isRetiring = false;

  // Stats State
  stats: StatsSummary | null = null;
  isLoadingStats = false;
  errorLogSearch = '';

  // Users State
  users: AdminUserDetail[] = [];
  isLoadingUsers = false;
  userSearch = '';

  // Edit User Display Name Modal
  showEditUserModal = false;
  editUserId = 0;
  editUserCurrentName = '';
  editUserNewName = '';
  editUserError = '';
  isSavingUser = false;

  // Delete User Modal
  showDeleteUserModal = false;
  deleteUserId = 0;
  deleteUserDisplayName = '';
  deleteUserError = '';
  isDeletingUser = false;

  ngOnInit(): void {
    this.checkAuth();
  }

  checkAuth(): void {
    this.isLoggedIn = this.adminService.isAuthenticated();
    if (this.isLoggedIn) {
      this.adminUsername = this.adminService.getUsername() || 'admin';
      this.loadAllInitialData();
    }
  }

  onLogin(): void {
    if (!this.loginUsername || !this.loginPassword) {
      this.loginError = 'Please enter both username and password.';
      this.cdr.markForCheck();
      return;
    }
    this.isLoggingIn = true;
    this.loginError = '';

    this.adminService.login(this.loginUsername, this.loginPassword).subscribe({
      next: (res) => {
        this.isLoggingIn = false;
        this.isLoggedIn = true;
        this.adminUsername = res.username;
        this.loadAllInitialData();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoggingIn = false;
        this.loginError = err.error || 'Authentication failed. Invalid admin credentials.';
        this.cdr.markForCheck();
      }
    });
  }

  onLogout(): void {
    this.adminService.logout();
    this.isLoggedIn = false;
    this.loginUsername = '';
    this.loginPassword = '';
    this.cdr.markForCheck();
  }

  // Preload all tab data once upon login/init
  loadAllInitialData(): void {
    this.loadSupportedCompetitions();
    this.loadAvailableCompetitions();
    this.loadStats();
    this.loadUsers();
  }

  // Tab switching loads previously loaded data without making fresh HTTP requests every time
  setTab(tab: 'competitions' | 'stats' | 'users'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  // Competitions Methods
  loadSupportedCompetitions(): void {
    this.isLoadingCompetitions = true;
    this.cdr.markForCheck();
    this.adminService.getSupportedCompetitions().subscribe({
      next: (data) => {
        this.supportedCompetitions = data || [];
        this.isLoadingCompetitions = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingCompetitions = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadAvailableCompetitions(): void {
    this.adminService.getAvailableCompetitions().subscribe({
      next: (res) => {
        this.availableCompetitions = res.competitions || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load available competitions', err);
        this.cdr.markForCheck();
      }
    });
  }

  openAddCompetitionModal(): void {
    this.showAddModal = true;
    if (this.availableCompetitions.length === 0) {
      this.loadAvailableCompetitions();
    }
    this.cdr.markForCheck();
  }

  closeAddCompetitionModal(): void {
    this.showAddModal = false;
    this.cdr.markForCheck();
  }

  isCompSupported(comp: AdminCompetition): boolean {
    return this.supportedCompetitions.some(c => c.id === comp.id || c.code === comp.code);
  }

  addCompetition(comp: AdminCompetition): void {
    this.adminService.addCompetition(comp.id).subscribe({
      next: () => {
        this.loadSupportedCompetitions();
        this.closeAddCompetitionModal();
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert('Failed to add competition: ' + (err.error || err.message));
        this.cdr.markForCheck();
      }
    });
  }

  viewCompetitionDetail(comp: AdminCompetition): void {
    this.compDetailLoading = true;
    this.selectedCompForDetail = comp; // Show immediately on first click
    this.cdr.markForCheck();

    this.adminService.getCompetitionDetail(comp.id).subscribe({
      next: (detail) => {
        this.selectedCompForDetail = detail;
        this.compDetailLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.compDetailLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeCompDetail(): void {
    this.selectedCompForDetail = null;
    this.cdr.markForCheck();
  }

  openRetireModal(comp: AdminCompetition, seasonId?: string | number): void {
    this.retireCompId = String(comp.id);
    this.retireCompName = comp.name;
    this.retireSeasonId = seasonId ? String(seasonId) : (comp.currentSeason ? String(comp.currentSeason.id) : '');
    this.retireError = '';
    this.retireSuccess = '';
    this.showRetireModal = true;
    this.cdr.markForCheck();
  }

  closeRetireModal(): void {
    this.showRetireModal = false;
    this.cdr.markForCheck();
  }

  confirmRetireSeason(): void {
    if (!this.retireSeasonId) {
      this.retireError = 'Season ID is required';
      this.cdr.markForCheck();
      return;
    }
    this.isRetiring = true;
    this.retireError = '';
    this.retireSuccess = '';
    this.cdr.markForCheck();

    this.adminService.retireSeason(this.retireCompId, this.retireSeasonId).subscribe({
      next: (res) => {
        this.isRetiring = false;
        this.retireSuccess = res.message || 'Season retired successfully!';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.closeRetireModal();
          this.loadSupportedCompetitions();
        }, 1200);
      },
      error: (err) => {
        this.isRetiring = false;
        this.retireError = err.error || err.message || 'Failed to retire season.';
        this.cdr.markForCheck();
      }
    });
  }

  // Stats Methods
  loadStats(): void {
    this.isLoadingStats = true;
    this.cdr.markForCheck();
    this.adminService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.isLoadingStats = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingStats = false;
        this.cdr.markForCheck();
      }
    });
  }

  getAPIEndpointList(): EndpointStat[] {
    if (!this.stats || !this.stats.apiEndpointStats) return [];
    return Object.values(this.stats.apiEndpointStats);
  }

  getHTTPEndpointList(): EndpointStat[] {
    if (!this.stats || !this.stats.httpEndpointStats) return [];
    return Object.values(this.stats.httpEndpointStats);
  }

  filteredErrorLogs(): any[] {
    if (!this.stats || !this.stats.recentErrors) return [];
    if (!this.errorLogSearch) return this.stats.recentErrors;
    const term = this.errorLogSearch.toLowerCase();
    return this.stats.recentErrors.filter(e =>
      e.endpoint.toLowerCase().includes(term) ||
      e.error.toLowerCase().includes(term) ||
      e.method.toLowerCase().includes(term) ||
      String(e.statusCode).includes(term)
    );
  }

  // Users Methods
  loadUsers(): void {
    this.isLoadingUsers = true;
    this.cdr.markForCheck();
    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users = data || [];
        this.isLoadingUsers = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingUsers = false;
        this.cdr.markForCheck();
      }
    });
  }

  filteredUsers(): AdminUserDetail[] {
    if (!this.userSearch) return this.users;
    const term = this.userSearch.toLowerCase();
    return this.users.filter(u =>
      u.displayName.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      String(u.id).includes(term)
    );
  }

  openEditUserModal(user: AdminUserDetail): void {
    this.editUserId = user.id;
    this.editUserCurrentName = user.displayName;
    this.editUserNewName = user.displayName;
    this.editUserError = '';
    this.showEditUserModal = true;
    this.cdr.markForCheck();
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.cdr.markForCheck();
  }

  saveUserDisplayName(): void {
    if (!this.editUserNewName.trim()) {
      this.editUserError = 'Display name cannot be empty.';
      this.cdr.markForCheck();
      return;
    }
    this.isSavingUser = true;
    this.editUserError = '';
    this.cdr.markForCheck();

    this.adminService.updateDisplayName(this.editUserId, this.editUserNewName).subscribe({
      next: () => {
        this.isSavingUser = false;
        this.closeEditUserModal();
        this.loadUsers();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingUser = false;
        this.editUserError = err.error || 'Failed to update display name.';
        this.cdr.markForCheck();
      }
    });
  }

  openDeleteUserModal(user: AdminUserDetail): void {
    this.deleteUserId = user.id;
    this.deleteUserDisplayName = user.displayName;
    this.deleteUserError = '';
    this.showDeleteUserModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal = false;
    this.cdr.markForCheck();
  }

  confirmDeleteUser(): void {
    this.isDeletingUser = true;
    this.deleteUserError = '';
    this.cdr.markForCheck();

    this.adminService.deleteUser(this.deleteUserId).subscribe({
      next: () => {
        this.isDeletingUser = false;
        this.closeDeleteUserModal();
        this.loadUsers();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isDeletingUser = false;
        this.deleteUserError = err.error || 'Failed to delete user.';
        this.cdr.markForCheck();
      }
    });
  }

  filteredAvailableCompetitions(): AdminCompetition[] {
    if (!this.competitionSearch) return this.availableCompetitions;
    const term = this.competitionSearch.toLowerCase();
    return this.availableCompetitions.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      (c.area && c.area.name.toLowerCase().includes(term))
    );
  }
}
