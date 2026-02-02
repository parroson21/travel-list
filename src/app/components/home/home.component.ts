import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { Observable, combineLatest, map } from 'rxjs';
import { POI, UserProfile } from '../../models/travel.model';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="container fade-in">
      <header class="dashboard-header">
        <h1>Welcome back, <span class="highlight">{{ (auth.user$ | async)?.displayName || 'Traveler' }}</span></h1>
        <p class="subtitle">Track your global journey and explore the world's heritage.</p>
      </header>

      <div class="stats-grid" *ngIf="stats$ | async as stats">
        <div class="glass-panel stat-card">
          <div class="stat-value">{{ stats.countriesVisited }} / 197</div>
          <div class="stat-label">Countries Visited</div>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="(stats.countriesVisited / 197) * 100"></div>
          </div>
        </div>
        <div class="glass-panel stat-card">
          <div class="stat-value">{{ stats.poisVisited }}</div>
          <div class="stat-label">Heritage Sites Visited</div>
        </div>
      </div>

      <section class="visited-list" *ngIf="visitedPOIs$ | async as visited">
        <h3>Recent Heritage Sites</h3>
        <div class="site-chips">
          <div class="glass-panel chip" *ngFor="let site of visited">
            {{ site.name }}
          </div>
          <div *ngIf="visited.length === 0" class="empty-state">No sites visited yet. Go to Explore!</div>
        </div>
      </section>
    </div>
  `,
    styles: [`
    .dashboard-header {
      margin-top: 3rem;
      margin-bottom: 3rem;
    }
    .highlight {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 4rem;
    }
    .stat-card {
      padding: 2rem;
      text-align: center;
    }
    .stat-value {
      font-size: 3rem;
      font-weight: 800;
      color: var(--text-main);
      margin-bottom: 0.5rem;
    }
    .stat-label {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .progress-bar {
      height: 6px;
      background: var(--glass-border);
      border-radius: 3px;
      margin-top: 1.5rem;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent-gradient);
      transition: width 1s ease-out;
    }
    .visited-list h3 {
      margin-bottom: 1.5rem;
    }
    .site-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .chip {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      border-radius: 2rem;
    }
    .empty-state {
      color: var(--text-muted);
      font-style: italic;
    }
  `]
})
export class HomeComponent implements OnInit {
    stats$: Observable<{ countriesVisited: number, poisVisited: number }> | undefined;
    visitedPOIs$: Observable<POI[]> | undefined;

    constructor(public travel: TravelService, public auth: AuthService) { }

    ngOnInit() {
        this.stats$ = this.travel.getUserProfile().pipe(
            map(profile => ({
                countriesVisited: profile?.visitedCountries?.length || 0,
                poisVisited: profile?.visitedPOIs?.length || 0
            }))
        );

        this.visitedPOIs$ = combineLatest([
            this.travel.getPOIs(),
            this.travel.getUserProfile()
        ]).pipe(
            map(([pois, profile]) => {
                if (!profile) return [];
                return pois.filter(p => profile.visitedPOIs?.includes(p.id)).slice(0, 10);
            })
        );
    }
}
