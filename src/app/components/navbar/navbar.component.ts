import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { SearchOverlayService } from '../../services/search-overlay.service';
import { SearchOverlayComponent } from '../search-overlay/search-overlay.component';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterModule, SearchOverlayComponent],
    templateUrl: './navbar.html',
    styleUrls: ['./navbar.scss']
})
export class NavbarComponent {
    @Output() changeUsername = new EventEmitter<void>();

    menuOpen = false;
    settingsOpen = false;
    showThemes = false;
    fabOpen = false;

    constructor(
        public auth: AuthService,
        public theme: ThemeService,
        public searchOverlay: SearchOverlayService
    ) { }

  toggleMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
    this.settingsOpen = false;
    if (this.menuOpen) {
      this.addCloseListener(() => this.menuOpen = false);
    }
  }

  toggleSettings(event: Event) {
    event.stopPropagation();
    this.settingsOpen = !this.settingsOpen;
    this.menuOpen = false;
    if (this.settingsOpen) {
      this.addCloseListener(() => this.settingsOpen = false);
    }
  }

  getPrimaryColor(palette: any): string {
    return Array.isArray(palette.primary) ? palette.primary[0] : palette.primary;
  }

  private addCloseListener(closeFn: () => void) {
    setTimeout(() => {
      const close = () => {
        closeFn();
        document.removeEventListener('click', close);
      };
      document.addEventListener('click', close);
    });
  }

  toggleFab(event: Event) {
    event.stopPropagation();
    this.fabOpen = !this.fabOpen;
    if (this.fabOpen) {
      this.addCloseListener(() => this.fabOpen = false);
    }
  }

  onChangeUsername() {
    this.changeUsername.emit();
  }
}
