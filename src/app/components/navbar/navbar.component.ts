import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="glass-panel navbar">
      <div class="container nav-content">
        <div class="brand" routerLink="/">TRAVEL<span>LIST</span></div>
        <div class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Dashboard</a>
          <a routerLink="/explore" routerLinkActive="active">Explore</a>
          <a *ngIf="auth.isAdmin$ | async" routerLink="/admin" routerLinkActive="active">Admin</a>
        </div>
        <div class="auth-section">
          <ng-container *ngIf="auth.user$ | async as user; else loginBtn">
            <div class="user-info">
              <span class="user-name">{{ user.displayName || user.email }}</span>
              <button class="btn btn-outline btn-sm" (click)="auth.logout()">Logout</button>
            </div>
          </ng-container>
          <ng-template #loginBtn>
            <button class="btn btn-primary" (click)="auth.loginWithGoogle()">Login</button>
          </ng-template>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      margin: 1rem;
      padding: 0.75rem 0;
      position: sticky;
      top: 1rem;
      z-index: 1000;
    }
    .nav-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      font-size: 1.5rem;
      letter-spacing: -1px;
      cursor: pointer;
    }
    .brand span {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .nav-links {
      display: flex;
      gap: 2rem;
    }
    .nav-links a {
      text-decoration: none;
      color: var(--text-muted);
      font-weight: 600;
      transition: color 0.3s;
    }
    .nav-links a.active, .nav-links a:hover {
      color: var(--text-main);
    }
    .auth-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .user-name {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--text-main);
    }
    .btn-sm {
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      border-radius: 4px;
    }
  `]
})
export class NavbarComponent {
  constructor(public auth: AuthService) { }
}
