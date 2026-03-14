import { Component, Input, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { TravelEntry } from '../../models/travel.model';
import { firstValueFrom, take } from 'rxjs';

@Component({
    selector: 'app-entry-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './entry-modal.component.html',
    styleUrls: ['./entry-modal.component.css']
})
export class EntryModalComponent implements OnInit {
    @Input() countryId!: string;
    @Input() countryName!: string;
    @Input() countryEmoji: string = '';
    /** If provided, the modal starts in "edit" mode */
    @Input() existingEntry?: TravelEntry;
    /** Show a Remove button to delete this entry */
    @Input() allowRemove = false;

    @Output() submitted = new EventEmitter<void>();
    @Output() closed = new EventEmitter<void>();
    @Output() removed = new EventEmitter<void>();

    status: 'visited' | 'planned' = 'visited';
    date: string = '';
    saving = false;
    removing = false;
    error: string | null = null;

    constructor(private travel: TravelService, private auth: AuthService) {}

    ngOnInit() {
        if (this.existingEntry) {
            this.status = this.existingEntry.status;
            this.date = this.existingEntry.date || new Date().toISOString().split('T')[0];
        } else {
            this.date = new Date().toISOString().split('T')[0];
        }
    }

    get todayIso(): string {
        return new Date().toISOString().split('T')[0];
    }

    /** True when the passed existingEntry is a client-only phantom (no real Firestore doc) */
    get isLegacyPhantom(): boolean {
        return !!this.existingEntry?.id?.startsWith('legacy-');
    }

    @HostListener('keydown.escape')
    onEscape() {
        this.close();
    }

    close() {
        this.closed.emit();
    }

    onBackdropClick(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
            this.close();
        }
    }

    async submit() {
        if (!this.date) {
            this.error = 'Please select a date.';
            return;
        }
        this.error = null;
        this.saving = true;

        try {
            const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
            if (!user) { this.auth.loginWithGoogle(); return; }

            if (this.existingEntry?.id && !this.isLegacyPhantom) {
                // Edit existing real Firestore entry
                await this.travel.updateTravelEntry(user.uid, this.existingEntry.id, {
                    status: this.status,
                    date: this.date
                });
            } else {
                // New entry OR legacy phantom — always create a fresh document
                await this.travel.addTravelEntry({
                    countryId: this.countryId,
                    countryName: this.countryName,
                    status: this.status,
                    date: this.date
                });
            }

            this.submitted.emit();
            this.close();
        } catch (e) {
            this.error = 'Failed to save. Please try again.';
        } finally {
            this.saving = false;
        }
    }

    async remove() {
        if (!this.existingEntry?.id) return;
        this.removing = true;
        this.error = null;
        try {
            const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
            if (!user) { this.auth.loginWithGoogle(); return; }
            await this.travel.deleteTravelEntry(user.uid, this.existingEntry.id);
            this.removed.emit();
            this.close();
        } catch (e) {
            this.error = 'Failed to remove. Please try again.';
        } finally {
            this.removing = false;
        }
    }
}
