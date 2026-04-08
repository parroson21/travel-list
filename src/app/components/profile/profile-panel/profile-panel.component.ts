import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Country } from '../../../models/travel.model';
import { ProfileEntryRow } from '../profile.component';

@Component({
    selector: 'app-profile-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [CommonModule],
    templateUrl: './profile-panel.component.html',
    styleUrls: ['./profile-panel.component.css']
})
export class ProfilePanelComponent {

    @Input() visitedEntryRows: ProfileEntryRow[] = [];
    @Input() plannedEntryRows: ProfileEntryRow[] = [];
    @Input() visitedHeritageSites: { site: any; countryName: string; countryEmoji: string }[] = [];
    @Input() hoveredSiteId: string | null = null;

    /** Emitted when a row body is clicked — parent should pan the map */
    @Output() rowFocused = new EventEmitter<Country>();
    /** Emitted when the country name button is clicked — parent should open the country overlay */
    @Output() countryNavigate = new EventEmitter<string>();
    /** Emitted when the edit pencil is clicked */
    @Output() editRequested = new EventEmitter<ProfileEntryRow>();
    /** Emitted whenever selectedSite changes (including null) — parent needs this for sheet-open class */
    @Output() selectedSiteChange = new EventEmitter<any | null>();
    /** Emitted when a site is selected — parent should fly map to it */
    @Output() siteFlyTo = new EventEmitter<any>();
    /** Emitted on hover change — parent passes to map [highlightedSiteId] */
    @Output() siteHoverChange = new EventEmitter<string | null>();

    activeTab: 'countries' | 'heritage' = 'countries';
    selectedSite: any = null;

    setActiveTab(tab: 'countries' | 'heritage') {
        this.activeTab = tab;
        if (tab !== 'heritage') {
            this.closeSiteDetails();
        }
    }

    /** Public so parent can call via @ViewChild when a map pin is clicked */
    openSiteDetails(site: any) {
        this.selectedSite = site;
        this.activeTab = 'heritage';
        this.selectedSiteChange.emit(site);
        this.siteFlyTo.emit(site);
    }

    closeSiteDetails() {
        this.selectedSite = null;
        this.selectedSiteChange.emit(null);
    }

    navigateSite(direction: 1 | -1) {
        if (!this.selectedSite || this.visitedHeritageSites.length === 0) return;
        const idx = this.visitedHeritageSites.findIndex(h => h.site.id_no === this.selectedSite.id_no);
        const next = (idx + direction + this.visitedHeritageSites.length) % this.visitedHeritageSites.length;
        this.openSiteDetails(this.visitedHeritageSites[next].site);
    }

    getSiteIndex(): number {
        if (!this.selectedSite) return 0;
        return this.visitedHeritageSites.findIndex(h => h.site.id_no === this.selectedSite.id_no);
    }

    onRowClick(row: ProfileEntryRow) {
        if (row.country) {
            this.rowFocused.emit(row.country);
        }
    }

    onCountryNameClick(countryId: string, event: MouseEvent) {
        event.stopPropagation();
        this.countryNavigate.emit(countryId);
    }

    onEditClick(row: ProfileEntryRow, event: MouseEvent) {
        event.stopPropagation();
        this.editRequested.emit(row);
    }

    onSiteHover(siteId: string | null) {
        this.siteHoverChange.emit(siteId);
    }
}
