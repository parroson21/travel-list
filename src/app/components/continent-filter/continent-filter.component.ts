import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Continent } from '../../models/travel.model';
import { FilterService } from '../../services/filter.service';

@Component({
    selector: 'app-continent-filter',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './continent-filter.component.html',
    styleUrls: ['./continent-filter.component.css']
})
export class ContinentFilterComponent {
    @Input() continents: Continent[] = [];
    @Input() continentCounts: Map<string, number> = new Map();
    @Input() selectedContinents: string[] = [];
    @Input() totalCount: number = 0;

    @Output() continentToggled = new EventEmitter<string>();
    @Output() filterCleared = new EventEmitter<void>();

    constructor(public filterService: FilterService) { }

    toggleContinent(continent: string) {
        this.continentToggled.emit(continent);
    }

    clearFilter() {
        this.filterCleared.emit();
    }

    isContinentSelected(continent: string): boolean {
        return this.selectedContinents.includes(continent);
    }

    toggleKeepSelection() {
        this.filterService.setKeepSelection(!this.filterService.keepSelection);
    }
}
