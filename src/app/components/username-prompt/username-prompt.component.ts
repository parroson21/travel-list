import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelService } from '../../services/travel.service';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
    selector: 'app-username-prompt',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule],
    templateUrl: './username-prompt.component.html',
    styleUrls: ['./username-prompt.component.css']
})
export class UsernamePromptComponent implements OnInit {
    /** 'create' = first-time mandatory prompt; 'update' = voluntary change (closeable) */
    @Input() mode: 'create' | 'update' = 'create';
    @Input() currentUsername = '';
    @Output() usernameSet = new EventEmitter<string>();
    @Output() closed = new EventEmitter<void>();

    usernameInput = '';
    checking = false;
    saving = false;
    available: boolean | null = null; // null = not checked yet
    error = '';

    private checkTimer: any;

    constructor(
        private travel: TravelService,
        public auth: AuthService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        if (this.mode === 'update' && this.currentUsername) {
            this.usernameInput = this.currentUsername;
        }
    }

    get normalized(): string {
        return this.usernameInput.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    }

    get isValid(): boolean {
        return this.normalized.length >= 3 && this.normalized.length <= 30;
    }

    get isUnchanged(): boolean {
        return this.mode === 'update' && this.normalized === this.currentUsername;
    }

    onInput() {
        this.available = null;
        this.error = '';
        clearTimeout(this.checkTimer);
        if (!this.isValid) return;
        if (this.isUnchanged) return;
        this.checking = true;
        this.cdr.markForCheck();
        this.checkTimer = setTimeout(() => this.checkAvailability(), 500);
    }

    async checkAvailability() {
        if (!this.isValid) return;
        try {
            this.available = await this.travel.checkUsernameAvailable(this.normalized);
        } catch {
            this.available = null;
        } finally {
            this.checking = false;
            this.cdr.markForCheck();
        }
    }

    async save() {
        if (!this.isValid || this.saving || this.isUnchanged) return;
        if (this.available !== true) return;
        const user = await firstValueFrom(this.auth.user$.pipe(take(1)));
        if (!user) return;
        this.saving = true;
        this.error = '';
        this.cdr.markForCheck();
        try {
            const oldUsername = this.mode === 'update' ? this.currentUsername : undefined;
            await this.travel.setUsername(user.uid, this.normalized, oldUsername);
            this.usernameSet.emit(this.normalized);
        } catch (e: any) {
            this.error = e.message || 'Failed to save username. Please try again.';
        } finally {
            this.saving = false;
            this.cdr.markForCheck();
        }
    }

    dismiss() {
        this.closed.emit();
    }
}
