import { Injectable, signal, effect } from '@angular/core';

export interface Palette {
    name: string;
    primary: string[];
    secondary: string;
    background: string;
    text: string;
    card: string;
    glass: string;
    isDark: boolean;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
    darkMode = signal(true);

    // Default palette
    private defaultDark: Palette = {
        name: 'Dark',
        primary: ['#008D8D', '#00B8B8', '#0ea5e9'],
        secondary: '#00B8B8',
        background: '#0f172a',
        text: '#f8fafc',
        card: '#1e293b',
        glass: 'rgba(255, 255, 255, 0.05)',
        isDark: true
    };

    private defaultLight: Palette = {
        name: 'Light',
        primary: ['#008D8D', '#0ea5e9', '#6366f1'],
        secondary: '#00B8B8',
        background: '#f0f2f5',
        text: '#1e293b',
        card: '#ffffff',
        glass: 'rgba(0, 0, 0, 0.03)',
        isDark: false
    };

    private pastelPalette: Palette = {
        name: 'Pastel',
        primary: ['#F28B85', '#F0B892', '#C8D99E', '#8DD4B8', '#A3ACD4'],
        secondary: '#E87A82',
        background: '#F0EDE8',
        text: '#3A3A3A',
        card: '#F5E8E2',
        glass: 'rgba(200, 140, 130, 0.1)',
        isDark: false
    };

    palettes: Palette[] = [
        this.defaultDark,
        this.defaultLight,
        this.pastelPalette,
        {
            name: 'Neon',
            primary: ['#00f2ff', '#00ff9d', '#ff00ea', '#fff200'],
            secondary: '#ff0055',
            background: '#050505',
            text: '#ffffff',
            card: '#111111',
            glass: 'rgba(255, 255, 255, 0.05)',
            isDark: true
        },
        {
            name: 'Sunset',
            primary: ['#FF512F', '#DD2476', '#FF8C00'],
            secondary: '#4568DC',
            background: '#1a0f1f',
            text: '#fff5e6',
            card: '#2d1b33',
            glass: 'rgba(255, 255, 255, 0.07)',
            isDark: true
        },
        {
            name: 'Midnight',
            primary: ['#6366f1', '#a855f7', '#ec4899', '#06b6d4'],
            secondary: '#06b6d4',
            background: '#020617',
            text: '#f1f5f9',
            card: '#0f172a',
            glass: 'rgba(255, 255, 255, 0.03)',
            isDark: true
        }
    ];

    selectedPaletteName = signal('Dark');

    constructor() {
        this.loadSettings();

        // Effect to apply theme whenever signals change
        effect(() => {
            this.applyTheme();
        });
    }

    private loadSettings() {
        const savedTheme = localStorage.getItem('theme-settings');
        if (savedTheme) {
            try {
                const settings = JSON.parse(savedTheme);
                this.selectedPaletteName.set(settings.palette || 'Dark');

                const palette = this.palettes.find(p => p.name === settings.palette) || this.defaultDark;
                this.darkMode.set(palette.isDark);
            } catch (e) {
                console.error('Error loading theme settings', e);
            }
        }
    }

    private saveSettings() {
        const settings = {
            palette: this.selectedPaletteName()
        };
        localStorage.setItem('theme-settings', JSON.stringify(settings));
    }

    setPalette(name: string) {
        const palette = this.palettes.find(p => p.name === name);
        if (palette) {
            this.selectedPaletteName.set(name);
            this.darkMode.set(palette.isDark);
            this.saveSettings();
        }
    }

    toggleTheme() {
        const current = this.selectedPaletteName();
        if (current === 'Dark') {
            this.setPalette('Light');
        } else if (current === 'Light') {
            this.setPalette('Dark');
        } else {
            this.darkMode.update(d => !d);
        }
    }

    getCurrentPalette(): Palette {
        return this.palettes.find(p => p.name === this.selectedPaletteName()) || this.defaultDark;
    }

    private applyTheme() {
        const palette = this.getCurrentPalette();
        const root = document.documentElement;

        const primary = palette.primary[0];
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-rgb', this.hexToRgb(primary));
        root.style.setProperty('--accent-color', primary);
        root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${primary} 0%, ${palette.secondary} 100%)`);

        root.style.setProperty('--secondary', palette.secondary);
        root.style.setProperty('--secondary-rgb', this.hexToRgb(palette.secondary));

        root.style.setProperty('--bg-dark', palette.background);
        root.style.setProperty('--bg-card', palette.card);
        root.style.setProperty('--text-main', palette.text);
        root.style.setProperty('--glass', palette.glass);
        root.setAttribute('data-theme', palette.name);

        if (palette.isDark) {
            root.classList.remove('light');
        } else {
            root.classList.add('light');
        }

        // Store primary colors array in a CSS variable for the map to use
        root.style.setProperty('--primary-colors', palette.primary.join(','));
    }

    private hexToRgb(hex: string): string {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }
}
