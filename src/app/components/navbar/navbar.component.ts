import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TravelService } from '../../services/travel.service';
import { ThemeService } from '../../services/theme.service';
import { SearchOverlayService } from '../../services/search-overlay.service';
import { SearchOverlayComponent } from '../search-overlay/search-overlay.component';
import { AddEntryComponent } from '../add-entry/add-entry.component';
import { PatchNotesComponent } from '../patch-notes/patch-notes.component';
import { VersionService } from '../../services/version.service';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterModule, SearchOverlayComponent, AddEntryComponent, PatchNotesComponent],
    templateUrl: './navbar.html',
    styleUrls: ['./navbar.scss']
})
export class NavbarComponent {
    @Output() changeUsername = new EventEmitter<void>();

    menuOpen = false;
    settingsOpen = false;
    showThemes = false;
    fabOpen = false;
    addEntryOpen = false;
    patchNotesOpen = false;

    readonly versionService = inject(VersionService);

    constructor(
        public auth: AuthService,
        public travel: TravelService,
        public theme: ThemeService,
        public searchOverlay: SearchOverlayService
    ) {
        this.userProfile$ = this.travel.getUserProfile();
    }

    readonly userProfile$: import('rxjs').Observable<import('../../models/travel.model').UserProfile | null>;

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
