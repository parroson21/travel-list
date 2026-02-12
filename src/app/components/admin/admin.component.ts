import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelService } from '../../services/travel.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container fade-in">
      <div class="glass-panel admin-panel">
        <h2>Seeding Utility</h2>
        <p>Use the buttons below to manage the database.</p>
        
        <div class="section">
          <h3>Seed Data</h3>
          <p class="section-desc">Seed countries from the JSON file. Subdivisions and heritage sites are included within each country.</p>
          <button class="btn btn-primary" (click)="seedCountries()" [disabled]="loadingSeeding">
            {{ loadingSeeding ? 'Seeding...' : 'Seed Countries' }}
          </button>
        </div>

        <div class="section danger-section">
          <h3>Destructive Actions</h3>
          <div class="action-row">
            <div>
              <p class="section-desc">Delete all countries from the database.</p>
              <button class="btn btn-danger" (click)="wipeCountryData()" [disabled]="loadingWipe">
                {{ loadingWipe ? 'Wiping...' : 'Wipe All Country Data' }}
              </button>
            </div>
          </div>
          <div class="action-row">
            <div>
              <p class="section-desc">Clear all users' visited countries and subdivisions. Users will be notified on their next login.</p>
              <button class="btn btn-danger" (click)="resetUserData()" [disabled]="loadingReset">
                {{ loadingReset ? 'Resetting...' : 'Reset All User Data' }}
              </button>
            </div>
          </div>
        </div>

        <div class="logs" *ngIf="logs.length > 0">
          <h3>Logs</h3>
          <ul>
            <li *ngFor="let log of logs">{{ log }}</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-panel {
      margin-top: 4rem;
      padding: 3rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    .section {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--glass-border);
    }
    .section h3 {
      margin-bottom: 0.5rem;
    }
    .section-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }
    .danger-section {
      border-top: 1px solid rgba(255, 100, 100, 0.3);
    }
    .danger-section h3 {
      color: #ff6b6b;
    }
    .action-row {
      margin-bottom: 1.5rem;
    }
    .btn-danger {
      background: rgba(255, 100, 100, 0.15);
      color: #ff6b6b;
      border: 1px solid rgba(255, 100, 100, 0.3);
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    .btn-danger:hover:not(:disabled) {
      background: rgba(255, 100, 100, 0.25);
    }
    .btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .logs {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--glass-border);
    }
    .logs ul {
      list-style: none;
      font-family: monospace;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
  `]
})
export class AdminComponent {
  loadingSeeding = false;
  loadingWipe = false;
  loadingReset = false;
  logs: string[] = [];

  constructor(private travel: TravelService, private http: HttpClient, private zone: NgZone, private cdr: ChangeDetectorRef) { }

  seedCountries() {
    this.loadingSeeding = true;
    this.addLog('Fetching countries.json...');

    this.http.get('countries.json').subscribe({
      next: (jsonContent: any) => {
        this.zone.run(async () => {
          this.addLog('Seeding countries, subdivisions, and heritage sites...');
          try {
            await this.travel.seedCountries(
              JSON.stringify(jsonContent),
              (msg: string) => this.addLog(msg)
            );
            this.addLog('Seeding complete!');
          } catch (e: any) {
            this.addLog('Error seeding: ' + e.message);
          }
          this.loadingSeeding = false;
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.addLog('Error fetching countries.json: ' + err.message);
          this.loadingSeeding = false;
        });
      }
    });
  }

  wipeCountryData() {
    this.loadingWipe = true;
    this.addLog('Starting country data wipe...');
    this.zone.run(async () => {
      try {
        await this.travel.wipeAllCountryData((msg: string) => this.addLog(msg));
      } catch (e: any) {
        this.addLog('Error wiping data: ' + e.message);
      }
      this.loadingWipe = false;
    });
  }

  resetUserData() {
    this.loadingReset = true;
    this.addLog('Starting user data reset...');
    this.zone.run(async () => {
      try {
        await this.travel.resetAllUserData((msg: string) => this.addLog(msg));
      } catch (e: any) {
        this.addLog('Error resetting user data: ' + e.message);
      }
      this.loadingReset = false;
    });
  }

  addLog(msg: string) {
    this.zone.run(() => {
      this.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      this.cdr.detectChanges();
    });
  }
}
