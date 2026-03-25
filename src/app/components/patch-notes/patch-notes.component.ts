import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VersionService } from '../../services/version.service';

@Component({
  selector: 'app-patch-notes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="patch-notes-backdrop" (click)="closed.emit()"></div>
    <div class="patch-notes-panel">
      <div class="pn-header">
        <div class="pn-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          Patch Notes
        </div>
        <button class="pn-close" (click)="closed.emit()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="pn-body">
        @for (patch of filteredPatches(); track patch.version) {
          <div class="patch-entry" [class.latest]="$first">
            <div class="patch-entry-header">
              <span class="patch-version">v{{ patch.version }}</span>
              @if ($first) { <span class="latest-badge">Latest</span> }
              <span class="patch-date">{{ patch.date }}</span>
            </div>
            <ul class="patch-notes-list">
              @for (note of patch.notes; track note) {
                <li>{{ note }}</li>
              }
            </ul>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .patch-notes-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      z-index: 9000;
      animation: pn-fade-in 0.2s ease;
    }

    .patch-notes-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9001;
      width: min(420px, 90vw);
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      border-radius: 1rem;
      animation: pn-slide-in 0.25s ease;
      overflow: hidden;
      background: var(--bg-card);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    }

    .pn-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--glass-border);
      flex-shrink: 0;
    }

    .pn-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-main);
    }

    .pn-close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 0.25rem;
      border-radius: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s, background 0.2s;
    }
    .pn-close:hover {
      color: var(--text-main);
      background: rgba(0,0,0,0.06);
    }

    .pn-body {
      overflow-y: auto;
      padding: 0.75rem 1.25rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .patch-entry {
      border-left: 2px solid var(--glass-border);
      padding-left: 0.875rem;
    }

    .patch-entry.latest {
      border-left-color: var(--primary, #6c8ff8);
    }

    .patch-entry-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
    }

    .patch-version {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-main);
      font-family: 'Courier New', monospace;
    }

    .latest-badge {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      background: var(--primary, #6c8ff8);
      color: #fff;
      opacity: 0.9;
    }

    .patch-date {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    .patch-notes-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .patch-notes-list li {
      font-size: 0.82rem;
      color: var(--text-muted);
      padding-left: 0.7rem;
      position: relative;
      line-height: 1.5;
    }

    .patch-notes-list li::before {
      content: '–';
      position: absolute;
      left: 0;
      color: var(--text-muted);
    }

    @keyframes pn-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes pn-slide-in {
      from { opacity: 0; transform: translate(-50%, -48%); }
      to   { opacity: 1; transform: translate(-50%, -50%); }
    }
  `]
})
export class PatchNotesComponent {
  @Output() closed = new EventEmitter<void>();
  protected version = inject(VersionService);

  /** Only show patches that share the same major.minor prefix as the current version. */
  protected filteredPatches = computed(() => {
    const [major, minor] = this.version.version().split('.');
    const prefix = `${major}.${minor}.`;
    return this.version.patches().filter(p => p.version.startsWith(prefix));
  });
}
