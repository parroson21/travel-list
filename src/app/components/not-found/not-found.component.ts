import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="not-found-container">
            <div class="not-found-card">
                <div class="not-found-icon">🌍</div>
                <h1>Page Not Found</h1>
                <p>This profile doesn't exist or the username may have changed.</p>
                <button class="btn-home" (click)="goHome()">Return Home</button>
            </div>
        </div>
    `,
    styles: [`
        .not-found-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 70vh;
            padding: 2rem;
        }
        .not-found-card {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            max-width: 400px;
        }
        .not-found-icon {
            font-size: 3.5rem;
            filter: grayscale(0.4);
        }
        h1 {
            font-size: 1.6rem;
            font-weight: 700;
            margin: 0;
            color: var(--text-main);
        }
        p {
            color: var(--text-muted);
            margin: 0;
            font-size: .95rem;
            line-height: 1.6;
        }
        .btn-home {
            margin-top: .5rem;
            padding: .65rem 1.6rem;
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: 10px;
            font-size: .9rem;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: opacity .2s;
        }
        .btn-home:hover { opacity: .85; }
    `]
})
export class NotFoundComponent {
    constructor(private router: Router) {}
    goHome() { this.router.navigate(['/']); }
}
