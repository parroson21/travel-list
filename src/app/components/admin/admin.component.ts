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
        <p>Click the buttons below to seed the database from JSON files. Heritage sites are seeded automatically with countries.</p>
        
        <div class="actions">
          <button class="btn btn-primary" (click)="seedCountries()" [disabled]="loadingCountries">
            {{ loadingCountries ? 'Seeding...' : 'Seed Countries & Heritage Sites' }}
          </button>
          <button class="btn btn-primary" (click)="seedStates()" [disabled]="loadingStates">
            {{ loadingStates ? 'Seeding...' : 'Seed States' }}
          </button>
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
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
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
  loadingCountries = false;
  loadingStates = false;
  logs: string[] = [];

  constructor(private travel: TravelService, private http: HttpClient, private zone: NgZone, private cdr: ChangeDetectorRef) { }

  seedCountries() {
    this.loadingCountries = true;
    this.addLog('Fetching countries.json...');

    this.http.get('countries.json').subscribe({
      next: (jsonContent: any) => {
        this.zone.run(async () => {
          this.addLog('Parsing and seeding countries (with heritage sites)...');
          try {
            await this.travel.seedCountries(JSON.stringify(jsonContent));
            this.addLog('Countries seeded successfully!');
          } catch (e: any) {
            this.addLog('Error seeding countries: ' + e.message);
          }
          this.loadingCountries = false;
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.addLog('Error fetching countries.json: ' + err.message);
          this.loadingCountries = false;
        });
      }
    });
  }

  seedStates() {
    this.loadingStates = true;
    this.addLog('Fetching states.json...');
    this.http.get('states.json').subscribe({
      next: (jsonContent: any) => {
        this.zone.run(async () => {
          this.addLog('Parsing and seeding states (this may take a while)...');
          try {
            await this.travel.seedSubdivisions(JSON.stringify(jsonContent));
            this.addLog('States seeded successfully!');
          } catch (e: any) {
            this.addLog('Error seeding states: ' + e.message);
          }
          this.loadingStates = false;
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.addLog('Error fetching states.json: ' + err.message);
          this.loadingStates = false;
        });
      }
    });
  }

  addLog(msg: string) {
    this.zone.run(() => {
      this.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      this.cdr.detectChanges();
    });
  }
}
