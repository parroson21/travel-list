import { Component, NgZone, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { HttpClient } from '@angular/common/http';
import { Country } from '../../models/travel.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent {
  // ── Tab state ─────────────────────────────────────────────
  activeTab: 'seeding' | 'countries' = 'seeding';

  // ── Seeding tab ───────────────────────────────────────────
  loadingSeeding = false;
  loadingWipe = false;
  loadingReset = false;
  logs: string[] = [];

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
  renamingDivision = '';      // division name currently being renamed
  divisionRenameValue = '';   // input value while renaming
  savingGroupRename = false;
  showAddFormForDivision = '';  // division name whose add-row is open
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

  constructor(
    private travel: TravelService,
    private http: HttpClient,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  setTab(tab: 'seeding' | 'countries') {
    this.activeTab = tab;
    if (tab === 'countries' && this.allCountries.length === 0) {
      this.loadAllCountries();
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
    // Copy only editable scalar fields into form
    this.editForm = {};
    for (const field of this.editableFields) {
      this.editForm[field.key] = (country as any)[field.key] ?? '';
    }
    this.saveSuccess = false;
    this.saveError = '';
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
      // Clone array and splice in the updated entry
      const subs = [...this.subdivisions];
      subs[this.selectedSubdivisionIndex] = {
        ...subs[this.selectedSubdivisionIndex],
        code: this.subForm['code'],
        name: this.subForm['name'],
        parent: this.subForm['parent'],
        // division, lat, lng preserved from the spread above
      };
      await this.travel.updateCountry(this.selectedCountry.id, { subdivisions: subs });
      // Patch local copy
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

  /** Subdivisions grouped by division type, sorted alphabetically. */
  get groupedSubdivisions(): { division: string; items: { sub: any; index: number }[] }[] {
    const groups: Record<string, { sub: any; index: number }[]> = {};
    this.subdivisions.forEach((sub, index) => {
      const div = sub.division || 'Other';
      if (!groups[div]) groups[div] = [];
      groups[div].push({ sub, index });
    });
    return Object.keys(groups).sort().map(division => ({
      division,
      items: groups[division].sort((a, b) => (a.sub.name || '').localeCompare(b.sub.name || ''))
    }));
  }

  /** Push subdivisions array to Firestore and patch the local country copy. */
  private async persistSubdivisions(subs: any[]): Promise<void> {
    await this.travel.updateCountry(this.selectedCountry!.id, { subdivisions: subs });
    (this.selectedCountry as any).subdivisions = subs;
  }

  async deleteSubdivision(index: number) {
    if (!this.selectedCountry) return;
    this.deletingIndex = index;
    try {
      const subs = [...this.subdivisions];
      subs.splice(index, 1);
      await this.persistSubdivisions(subs);
      // If we were editing the deleted item, go back
      if (this.selectedSubdivisionIndex === index) this.clearSubdivision();
    } catch (e: any) {
      console.error('Delete failed', e);
    } finally {
      this.zone.run(() => { this.deletingIndex = -1; this.cdr.detectChanges(); });
    }
  }

  openAddForm(division: string) {
    this.showAddFormForDivision = division;
    this.addForm = {
      code: '',
      name: '',
      division,
    };
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
      // If add form was open for this group, update it too
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

    // Build the diff — only changed fields
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
        // Patch local copy
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

  // ── Seeding tab logic ─────────────────────────────────────
  seedCountries() {
    this.loadingSeeding = true;
    this.addLog('Fetching countries.json...');
    this.http.get('countries.json').subscribe({
      next: (jsonContent: any) => {
        this.zone.run(async () => {
          this.addLog('Seeding countries, subdivisions, and heritage sites...');
          try {
            await this.travel.seedCountries(JSON.stringify(jsonContent), (msg: string) => this.addLog(msg));
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
