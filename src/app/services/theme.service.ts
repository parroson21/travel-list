import { Injectable, signal, effect } from '@angular/core';

export interface HeritageColors {
    cultural: string;
    natural: string;
    mixed: string;
}

export interface Palette {
    name: string;
    primary: string[];
    secondary: string;
    background: string;
    text: string;
    card: string;
    glass: string;
    isDark: boolean;
    heritageColors: HeritageColors;
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
        isDark: true,
        heritageColors: { cultural: '#4a90d9', natural: '#27ae60', mixed: '#E67E22' }
    };

    private defaultLight: Palette = {
        name: 'Light',
        primary: ['#008D8D', '#0ea5e9', '#6366f1'],
        secondary: '#00B8B8',
        background: '#f0f2f5',
        text: '#1e293b',
        card: '#ffffff',
        glass: 'rgba(0, 0, 0, 0.03)',
        isDark: false,
        heritageColors: { cultural: '#4a90d9', natural: '#27ae60', mixed: '#E67E22' }
    };

    private pastelPalette: Palette = {
        name: 'Pastel',
        primary: ['#F28B85', '#F0B892', '#C8D99E', '#8DD4B8', '#A3ACD4'],
        secondary: '#E87A82',
        background: '#F0EDE8',
        text: '#3A3A3A',
        card: '#F5E8E2',
        glass: 'rgba(200, 140, 130, 0.1)',
        isDark: false,
        heritageColors: { cultural: '#A3ACD4', natural: '#C8D99E', mixed: '#F0B892' }
    };

    private earthtonePalette: Palette = {
        name: 'Earthtone',
        primary: ['#5c7a4e', '#4e6e42', '#7a9e6a', '#3d5c32', '#8fb87e', '#6b8f5e', '#a3c48f', '#2e4a26'],
        secondary: '#4a7fa5',
        background: '#ede0ce',
        text: '#3d2b1f',
        card: '#f8f0e3',
        glass: 'rgba(139, 90, 43, 0.08)',
        isDark: false,
        heritageColors: { cultural: '#4a7fa5', natural: '#5c7a4e', mixed: '#C07830' }
    };

    private midnightPalette: Palette = {
        name: 'Midnight',
        primary: ['#6366f1', '#a855f7', '#ec4899', '#06b6d4'],
        secondary: '#06b6d4',
        background: '#020617',
        text: '#f1f5f9',
        card: '#0f172a',
        glass: 'rgba(255, 255, 255, 0.03)',
        isDark: true,
        heritageColors: { cultural: '#6366f1', natural: '#10b981', mixed: '#f59e0b' }
    };

    private sunsetPalette: Palette = {
        name: 'Sunset',
        primary: ['#FF512F', '#DD2476', '#FF8C00'],
        secondary: '#4568DC',
        background: '#1a0f1f',
        text: '#fff5e6',
        card: '#2d1b33',
        glass: 'rgba(255, 255, 255, 0.07)',
        isDark: true,
        heritageColors: { cultural: '#4568DC', natural: '#FF8C00', mixed: '#DD2476' }
    };

    palettes: Palette[] = [
        this.defaultDark,
        this.midnightPalette,
        this.sunsetPalette,
        this.defaultLight,
        this.pastelPalette,
        this.earthtonePalette

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
        root.style.setProperty('--primary-hover', this.darkenHex(primary, 0.15));
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

        // Heritage site type colours — independent of primary/secondary
        root.style.setProperty('--heritage-cultural', palette.heritageColors.cultural);
        root.style.setProperty('--heritage-cultural-rgb', this.hexToRgb(palette.heritageColors.cultural));
        root.style.setProperty('--heritage-natural', palette.heritageColors.natural);
        root.style.setProperty('--heritage-natural-rgb', this.hexToRgb(palette.heritageColors.natural));
        root.style.setProperty('--heritage-mixed', palette.heritageColors.mixed);
        root.style.setProperty('--heritage-mixed-rgb', this.hexToRgb(palette.heritageColors.mixed));

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

    /** Darken a hex colour by `amount` (0–1 fraction). */
    private darkenHex(hex: string, amount: number): string {
        hex = hex.replace('#', '');
        const r = Math.max(0, Math.round(parseInt(hex.substring(0, 2), 16) * (1 - amount)));
        const g = Math.max(0, Math.round(parseInt(hex.substring(2, 4), 16) * (1 - amount)));
        const b = Math.max(0, Math.round(parseInt(hex.substring(4, 6), 16) * (1 - amount)));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}
