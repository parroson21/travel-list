import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Continent } from '../../models/travel.model';

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
    @Input() selectedContinent: string = '';
    @Input() totalCount: number = 0;

    @Output() continentSelected = new EventEmitter<string>();
    @Output() filterCleared = new EventEmitter<void>();

    selectContinent(continent: string) {
        this.continentSelected.emit(continent);
    }

    clearFilter() {
        this.filterCleared.emit();
    }
}
