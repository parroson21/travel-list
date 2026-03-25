import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { UsernamePromptComponent } from './components/username-prompt/username-prompt.component';
import { CountryOverlayComponent } from './components/country-detail/country-detail.component';
import { TravelService } from './services/travel.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, CommonModule, UsernamePromptComponent, CountryOverlayComponent],
  template: `
    <app-navbar (changeUsername)="openChangeUsername()"></app-navbar>
    <main>
      <router-outlet></router-outlet>
    </main>

    <!-- Country overlay — globally mounted, driven by URL hash -->
    <app-country-overlay></app-country-overlay>

    <!-- Username Prompt — create mode (mandatory) or update mode (closeable) -->
    <app-username-prompt
      *ngIf="showUsernamePrompt"
      [mode]="usernamePromptMode"
      [currentUsername]="currentUsername"
      (usernameSet)="onUsernameSet()"
      (closed)="onPromptClosed()">
    </app-username-prompt>

    <!-- Data Reset Toast -->
    <div class="toast-container" *ngIf="showResetToast" (click)="dismissToast()">
      <div class="toast glass-panel fade-in">
        <div class="toast-icon">⚠️</div>
        <div class="toast-content">
          <div class="toast-title">Data Reset</div>
          <div class="toast-message">Sorry, your saved countries and subdivisions have been reset due to an update.</div>
        </div>
        <button class="toast-dismiss" (click)="dismissToast()">✕</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 10000;
      animation: slideUp 0.4s ease-out;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      max-width: 420px;
      border: 1px solid rgba(255, 180, 50, 0.3);
      background: rgba(20, 20, 30, 0.95);
      backdrop-filter: blur(12px);
      border-radius: 0.75rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .toast-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }
    .toast-content { flex: 1; }
    .toast-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: #ffb432;
      margin-bottom: 0.25rem;
    }
    .toast-message {
      font-size: 0.85rem;
      color: var(--text-muted, #aaa);
      line-height: 1.4;
    }
    .toast-dismiss {
      background: none;
      border: none;
      color: var(--text-muted, #aaa);
      cursor: pointer;
      font-size: 1rem;
      padding: 0.25rem;
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.2s ease;
    }
    .toast-dismiss:hover { opacity: 1; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(1rem); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'travel-app';
  showResetToast = false;
  showUsernamePrompt = false;
  usernamePromptMode: 'create' | 'update' = 'create';
  currentUsername = '';
  private profileSub: Subscription | null = null;

  constructor(private travel: TravelService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.profileSub = this.travel.getUserProfile().subscribe(profile => {
      if (profile?.dataResetNotification) {
        this.showResetToast = true;
      }
      // Track current username for change-username flow
      this.currentUsername = profile?.username || '';
      // Show mandatory prompt if user is logged in but hasn't set a username
      if (!!profile && !profile.username) {
        this.usernamePromptMode = 'create';
        this.showUsernamePrompt = true;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    this.profileSub?.unsubscribe();
  }

  openChangeUsername() {
    this.usernamePromptMode = 'update';
    this.showUsernamePrompt = true;
    this.cdr.markForCheck();
  }

  onUsernameSet() {
    this.showUsernamePrompt = false;
    this.cdr.markForCheck();
  }

  onPromptClosed() {
    this.showUsernamePrompt = false;
    this.cdr.markForCheck();
  }

  dismissToast() {
    this.showResetToast = false;
    this.travel.clearResetNotification();
  }
}
