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
        <p>Click the buttons below to seed the database from public CSV files.</p>
        
        <div class="actions">
          <button class="btn btn-primary" (click)="seedCountries()" [disabled]="loadingCountries">
            {{ loadingCountries ? 'Seeding...' : 'Seed Countries' }}
          </button>
          <button class="btn btn-primary" (click)="seedPOIs()" [disabled]="loadingPOIs">
            {{ loadingPOIs ? 'Seeding...' : 'Seed Heritage Sites' }}
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
  loadingPOIs = false;
  logs: string[] = [];

  constructor(private travel: TravelService, private http: HttpClient, private zone: NgZone, private cdr: ChangeDetectorRef) { }

  seedCountries() {
    this.loadingCountries = true;
    this.addLog('Fetching countries.csv and countries.csv...');

    // Fetch both CSVs
    this.http.get('countries.csv', { responseType: 'text' }).subscribe({
      next: (csvNew) => {
        this.http.get('countries.csv', { responseType: 'text' }).subscribe({
          next: (csvCoords) => {
            this.zone.run(async () => {
              this.addLog('Parsing and seeding countries...');
              try {
                await this.travel.seedCountries(csvNew, csvCoords);
                this.addLog('Countries seeded successfully!');
              } catch (e: any) {
                this.addLog('Error seeding countries: ' + e.message);
              }
              this.loadingCountries = false;
            });
          },
          error: (err) => {
            this.zone.run(() => {
              this.addLog('Error fetching countries.csv: ' + err.message);
              this.loadingCountries = false;
            });
          }
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.addLog('Error fetching countries.csv: ' + err.message);
          this.loadingCountries = false;
        });
      }
    });
  }

  seedPOIs() {
    this.loadingPOIs = true;
    this.addLog('Fetching whc-sites-2025.csv...');
    this.http.get('whc-sites-2025.csv', { responseType: 'text' }).subscribe({
      next: (csv) => {
        this.zone.run(async () => {
          this.addLog('Parsing and seeding POIs...');
          try {
            await this.travel.seedPOIs(csv);
            this.addLog('POIs seeded successfully!');
          } catch (e: any) {
            this.addLog('Error seeding POIs: ' + e.message);
          }
          this.loadingPOIs = false;
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.addLog('Error fetching file: ' + err.message);
          this.loadingPOIs = false;
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
