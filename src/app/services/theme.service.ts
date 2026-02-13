import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    darkMode = signal(true);

    constructor() {
        const saved = localStorage.getItem('theme');
        if (saved === 'light') {
            this.darkMode.set(false);
            document.documentElement.classList.add('light');
        }
    }

    toggleTheme() {
        const isDark = !this.darkMode();
        this.darkMode.set(isDark);
        if (isDark) {
            document.documentElement.classList.remove('light');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.add('light');
            localStorage.setItem('theme', 'light');
        }
    }
}
