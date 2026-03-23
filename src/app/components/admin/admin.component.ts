import { Component, NgZone, ChangeDetectorRef, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { Country, UserProfile } from '../../models/travel.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit {
  // ── Tab state ─────────────────────────────────────────────
  activeTab: 'countries' | 'users' = 'countries';

  // ── Countries tab ─────────────────────────────────────────
  allCountries: Country[] = [];
  loadingCountries = false;
  searchQuery = '';
  selectedCountry: Country | null = null;
  editForm: Record<string, any> = {};
  saving = false;
  saveSuccess = false;
  saveError = '';

  // Subdivision drill-down
  editMode: 'country' | 'subdivision' = 'country';
  subdivisionSearch = '';
  selectedSubdivision: any = null;
  selectedSubdivisionIndex = -1;
  subForm: Record<string, any> = {};
  savingSubdivision = false;
  subSaveSuccess = false;
  subSaveError = '';

  // Group management
  renamingDivision = '';
  divisionRenameValue = '';
  savingGroupRename = false;
  showAddFormForDivision = '';
  addForm = { code: '', name: '', division: '' };
  savingAdd = false;
  addError = '';
  deletingIndex = -1;

  readonly editableFields: { key: keyof Country; label: string; type: 'text' | 'number' }[] = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'capital', label: 'Capital', type: 'text' },
    { key: 'emoji', label: 'Emoji', type: 'text' },
    { key: 'native', label: 'Native Name', type: 'text' },
    { key: 'continent', label: 'Continent', type: 'text' },
    { key: 'region', label: 'Sub-region', type: 'text' },
    { key: 'iso3', label: 'ISO3 Code', type: 'text' },
    { key: 'nationality', label: 'Nationality', type: 'text' },
    { key: 'currency', label: 'Currency Code', type: 'text' },
    { key: 'currency_name', label: 'Currency Name', type: 'text' },
    { key: 'currency_symbol', label: 'Currency Symbol', type: 'text' },
    { key: 'latitude', label: 'Latitude', type: 'number' },
    { key: 'longitude', label: 'Longitude', type: 'number' },
    { key: 'population', label: 'Population', type: 'number' },
    { key: 'area_sq_km', label: 'Area (km²)', type: 'number' },
    { key: 'gdp', label: 'GDP', type: 'number' },
  ];

  // ── Users tab ─────────────────────────────────────────────
  allUsers: UserProfile[] = [];
  loadingUsers = false;
  usersLoaded = false;
  userSearch = '';
  selectedUser: UserProfile | null = null;
  userForm: { username: string; displayName: string; email: string } = { username: '', displayName: '', email: '' };
  savingUser = false;
  userSaveSuccess = false;
  userSaveError = '';

  constructor(
    private travel: TravelService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadAllCountries();
  }

  setTab(tab: 'countries' | 'users') {
    this.activeTab = tab;
    if (tab === 'users' && !this.usersLoaded) {
      this.loadAllUsers();
    }
  }

  // ── Countries tab logic ───────────────────────────────────
  loadAllCountries() {
    this.loadingCountries = true;
    this.travel.getCountries().subscribe(countries => {
      this.zone.run(() => {
        this.allCountries = countries;
        this.loadingCountries = false;
        this.cdr.detectChanges();
      });
    });
  }

  get filteredCountries(): Country[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.allCountries.slice(0, 50);
    return this.allCountries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.capital || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  selectCountry(country: Country) {
    this.selectedCountry = country;
    this.editMode = 'country';
    this.selectedSubdivision = null;
    this.selectedSubdivisionIndex = -1;
    this.subdivisionSearch = '';
    this.editForm = {};
    for (const field of this.editableFields) {
      this.editForm[field.key] = (country as any)[field.key] ?? '';
    }
    this.saveSuccess = false;
    this.saveError = '';
    this.rebuildGrouped();
  }

  clearSelection() {
    this.selectedCountry = null;
    this.editForm = {};
    this.editMode = 'country';
    this.selectedSubdivision = null;
  }

  // ── Subdivision drill-down ─────────────────────────────────
  get subdivisions(): any[] {
    return (this.selectedCountry as any)?.subdivisions || [];
  }

  get filteredSubdivisions(): any[] {
    const q = this.subdivisionSearch.trim().toLowerCase();
    if (!q) return this.subdivisions;
    return this.subdivisions.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.division || '').toLowerCase().includes(q)
    );
  }

  selectSubdivision(sub: any, index: number) {
    this.selectedSubdivision = sub;
    this.selectedSubdivisionIndex = index;
    this.subForm = {
      code: sub.code ?? '',
      name: sub.name ?? '',
      parent: sub.parent ?? '',
    };
    this.editMode = 'subdivision';
    this.subSaveSuccess = false;
    this.subSaveError = '';
  }

  clearSubdivision() {
    this.selectedSubdivision = null;
    this.selectedSubdivisionIndex = -1;
    this.editMode = 'country';
  }

  async saveSubdivision() {
    if (!this.selectedCountry || this.selectedSubdivisionIndex < 0) return;
    this.savingSubdivision = true;
    this.subSaveSuccess = false;
    this.subSaveError = '';

    try {
      const subs = [...this.subdivisions];
      subs[this.selectedSubdivisionIndex] = {
        ...subs[this.selectedSubdivisionIndex],
        code: this.subForm['code'],
        name: this.subForm['name'],
        parent: this.subForm['parent'],
      };
      await this.travel.updateCountry(this.selectedCountry.id, { subdivisions: subs });
      (this.selectedCountry as any).subdivisions = subs;
      this.selectedSubdivision = subs[this.selectedSubdivisionIndex];
      this.subSaveSuccess = true;
    } catch (e: any) {
      this.subSaveError = e.message || 'Unknown error';
    } finally {
      this.zone.run(() => {
        this.savingSubdivision = false;
        this.cdr.detectChanges();
      });
    }
  }

  // ── Group management ────────────────────────────────────────
  /** Cached — rebuilt only when subdivisions actually change (not on every CD cycle) */
  groupedSubdivisions: { division: string; items: { sub: any; index: number }[] }[] = [];

  private rebuildGrouped() {
    const groups: Record<string, { sub: any; index: number }[]> = {};
    this.subdivisions.forEach((sub, index) => {
      const div = sub.division || 'Other';
      if (!groups[div]) groups[div] = [];
      groups[div].push({ sub, index });
    });
    this.groupedSubdivisions = Object.keys(groups).sort().map(division => ({
      division,
      items: groups[division].sort((a, b) => (a.sub.name || '').localeCompare(b.sub.name || ''))
    }));
  }

  private async persistSubdivisions(subs: any[]): Promise<void> {
    await this.travel.updateCountry(this.selectedCountry!.id, { subdivisions: subs });
    (this.selectedCountry as any).subdivisions = subs;
    this.rebuildGrouped();
  }

  async deleteSubdivision(index: number) {
    if (!this.selectedCountry) return;
    this.deletingIndex = index;
    try {
      const subs = [...this.subdivisions];
      subs.splice(index, 1);
      await this.persistSubdivisions(subs);
      if (this.selectedSubdivisionIndex === index) this.clearSubdivision();
    } catch (e: any) {
      console.error('Delete failed', e);
    } finally {
      this.zone.run(() => { this.deletingIndex = -1; this.cdr.detectChanges(); });
    }
  }

  openAddForm(division: string) {
    this.showAddFormForDivision = division;
    this.addForm = { code: '', name: '', division };
    this.addError = '';
  }

  closeAddForm() {
    this.showAddFormForDivision = '';
  }

  async saveNewSubdivision() {
    if (!this.selectedCountry || !this.addForm.code.trim() || !this.addForm.name.trim()) {
      this.addError = 'Code and Name are required.';
      return;
    }
    this.savingAdd = true;
    this.addError = '';
    try {
      const newSub = {
        code: this.addForm.code.trim(),
        name: this.addForm.name.trim(),
        division: this.addForm.division,
        parent: this.selectedCountry.id,
      };
      const subs = [...this.subdivisions, newSub];
      await this.persistSubdivisions(subs);
      this.closeAddForm();
    } catch (e: any) {
      this.addError = e.message || 'Unknown error';
    } finally {
      this.zone.run(() => { this.savingAdd = false; this.cdr.detectChanges(); });
    }
  }

  startRenameGroup(division: string) {
    this.renamingDivision = division;
    this.divisionRenameValue = division;
  }

  cancelRenameGroup() {
    this.renamingDivision = '';
    this.divisionRenameValue = '';
  }

  async saveRenameGroup() {
    const newName = this.divisionRenameValue.trim();
    if (!this.selectedCountry || !newName || newName === this.renamingDivision) {
      this.cancelRenameGroup();
      return;
    }
    this.savingGroupRename = true;
    try {
      const subs = this.subdivisions.map(s =>
        s.division === this.renamingDivision ? { ...s, division: newName } : s
      );
      await this.persistSubdivisions(subs);
      if (this.showAddFormForDivision === this.renamingDivision) {
        this.showAddFormForDivision = newName;
        this.addForm.division = newName;
      }
      this.cancelRenameGroup();
    } catch (e: any) {
      console.error('Rename failed', e);
    } finally {
      this.zone.run(() => { this.savingGroupRename = false; this.cdr.detectChanges(); });
    }
  }

  async saveCountry() {
    if (!this.selectedCountry) return;
    this.saving = true;
    this.saveSuccess = false;
    this.saveError = '';

    const changes: Record<string, any> = {};
    for (const field of this.editableFields) {
      const orig = (this.selectedCountry as any)[field.key] ?? '';
      const next = field.type === 'number'
        ? (this.editForm[field.key] === '' ? null : Number(this.editForm[field.key]))
        : this.editForm[field.key];
      if (next !== orig) changes[field.key] = next;
    }

    try {
      if (Object.keys(changes).length > 0) {
        await this.travel.updateCountry(this.selectedCountry.id, changes);
        Object.assign(this.selectedCountry as any, changes);
      }
      this.saveSuccess = true;
    } catch (e: any) {
      this.saveError = e.message || 'Unknown error';
    } finally {
      this.zone.run(() => {
        this.saving = false;
        this.cdr.detectChanges();
      });
    }
  }

  // ── Users tab logic ───────────────────────────────────────
  async loadAllUsers() {
    this.loadingUsers = true;
    try {
      const users = await this.travel.getAllUsers();
      this.zone.run(() => {
        this.allUsers = users;
        this.usersLoaded = true;
        this.loadingUsers = false;
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      this.zone.run(() => {
        this.loadingUsers = false;
        this.cdr.detectChanges();
      });
    }
  }

  get filteredUsers(): UserProfile[] {
    const q = this.userSearch.trim().toLowerCase();
    if (!q) return this.allUsers;
    return this.allUsers.filter(u =>
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }

  userInitial(user: UserProfile): string {
    return (user.displayName || user.email || '?')[0].toUpperCase();
  }

  selectUser(user: UserProfile) {
    this.selectedUser = user;
    this.userForm = {
      username: user.username || '',
      displayName: user.displayName || '',
      email: user.email || '',
    };
    this.userSaveSuccess = false;
    this.userSaveError = '';
  }

  // ── trackBy helpers (prevent full DOM rebuild on every CD cycle) ──────
  trackByCountryId(_: number, c: Country) { return c.id; }
  trackByUserId(_: number, u: UserProfile) { return u.uid; }
  trackByDivision(_: number, g: { division: string }) { return g.division; }
  trackBySubCode(i: number, item: { sub: any }) { return item.sub.code ?? i; }
  trackByFieldKey(_: number, f: { key: string }) { return f.key; }

  clearUser() {
    this.selectedUser = null;
    this.userForm = { username: '', displayName: '', email: '' };
  }

  formatProvider(provider?: string): string {
    if (!provider) return '—';
    const map: Record<string, string> = {
      'google.com': 'Google',
      'password': 'Email / Password',
      'facebook.com': 'Facebook',
      'twitter.com': 'Twitter',
      'github.com': 'GitHub',
      'apple.com': 'Apple',
    };
    return map[provider] || provider;
  }

  async saveUser() {
    if (!this.selectedUser) return;
    this.savingUser = true;
    this.userSaveSuccess = false;
    this.userSaveError = '';

    try {
      // Handle username change via atomic setUsername
      const newUsername = this.userForm.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
      const oldUsername = this.selectedUser.username || undefined;
      if (newUsername && newUsername !== oldUsername) {
        await this.travel.setUsername(this.selectedUser.uid, newUsername, oldUsername);
        Object.assign(this.selectedUser, { username: newUsername });
        // Patch list entry too
        const idx = this.allUsers.findIndex(u => u.uid === this.selectedUser!.uid);
        if (idx >= 0) this.allUsers[idx] = { ...this.allUsers[idx], username: newUsername };
      }

      // Handle displayName / email changes
      const profileChanges: Partial<Pick<UserProfile, 'displayName' | 'email'>> = {};
      if (this.userForm.displayName !== (this.selectedUser.displayName || '')) {
        profileChanges.displayName = this.userForm.displayName;
      }
      if (this.userForm.email !== (this.selectedUser.email || '')) {
        profileChanges.email = this.userForm.email;
      }
      if (Object.keys(profileChanges).length > 0) {
        await this.travel.updateUserProfile(this.selectedUser.uid, profileChanges);
        Object.assign(this.selectedUser, profileChanges);
      }

      this.userSaveSuccess = true;
    } catch (e: any) {
      this.userSaveError = e.message || 'Unknown error';
    } finally {
      this.zone.run(() => {
        this.savingUser = false;
        this.cdr.detectChanges();
      });
    }
  }
}
