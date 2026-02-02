import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container fade-in">
      <div class="glass-panel auth-card">
        <div class="icon-header">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
           </svg>
        </div>
        <h2>Start Your <span class="highlight">Journey</span></h2>
        <p>Sign in with your Google account to track your travels and explore world heritage sites.</p>

        <button class="btn btn-primary google-btn" (click)="loginWithGoogle()">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          Sign in with Google
        </button>

        <p class="footer-note">Secure login powered by Firebase Authentication.</p>
      </div>
    </div>
  `,
  styles: [`
    .auth-card {
      margin-top: 8rem;
      padding: 4rem 2rem;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
    .icon-header {
      color: var(--primary);
      margin-bottom: 0.5rem;
    }
    .highlight {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 380px;
    }
    .google-btn {
      width: 100%;
      height: 3.5rem;
      font-size: 1.1rem;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .footer-note {
      font-size: 0.8rem;
      color: var(--text-muted);
      opacity: 0.7;
    }
  `]
})
export class AuthComponent {
  error = '';

  constructor(private auth: AuthService, private router: Router) { }

  async loginWithGoogle() {
    try {
      await this.auth.loginWithGoogle();
      // Redirect handled by service or callback if needed, but for simple app:
      this.router.navigate(['/']);
    } catch (e: any) {
      this.error = e.message;
    }
  }
}
