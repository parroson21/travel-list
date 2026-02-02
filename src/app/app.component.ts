import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div style="background: #4f46e5; color: white; padding: 1rem; text-align: center; font-weight: bold;">
      System Status: Application Active
    </div>
    <app-navbar></app-navbar>
    <main>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    main {
      padding-top: 2rem;
    }
  `]
})
export class AppComponent {
  title = 'travel-app';
}
