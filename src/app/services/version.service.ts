import { Injectable, signal } from '@angular/core';
import versionData from '../../version.json';

export interface PatchEntry {
  version: string;
  date: string;
  notes: string[];
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  readonly version = signal<string>(versionData.version);
  readonly patches = signal<PatchEntry[]>(versionData.patches as PatchEntry[]);
}
