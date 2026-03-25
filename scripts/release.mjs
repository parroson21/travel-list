/**
 * release.mjs — version bump + deploy script
 *
 * Usage:
 *   npm run release -- --minor -m "What changed"
 *   npm run release -- --major -m "Big change" -m "Another note"
 *
 * --minor  bumps the PATCH segment:  0.2.2 → 0.2.3
 * --major  bumps the MINOR segment:  0.2.2 → 0.3.0
 * -m       release note (required, repeatable for multiple lines)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = join(__dirname, '..', 'src', 'version.json');

// ── Parse CLI arguments ────────────────────────────────────────────────────
const args = process.argv.slice(2);

const isMajor = args.includes('--major');
const isMinor = args.includes('--minor');

if (!isMajor && !isMinor) {
  console.error('❌  Error: You must specify --major or --minor.');
  console.error('    --minor  bumps the patch segment  (0.2.2 → 0.2.3)');
  console.error('    --major  bumps the minor segment  (0.2.2 → 0.3.0)');
  process.exit(1);
}

// Collect all -m values
const notes = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-m' && args[i + 1]) {
    notes.push(args[i + 1]);
    i++;
  }
}

if (notes.length === 0) {
  console.error('❌  Error: You must provide at least one -m "message" note.');
  console.error('    Example: npm run release -- --minor -m "Fixed map zoom bug"');
  process.exit(1);
}

// ── Read current version ───────────────────────────────────────────────────
const versionData = JSON.parse(readFileSync(versionFile, 'utf-8'));
const [major, minor, patch] = versionData.version.split('.').map(Number);

// ── Compute new version ────────────────────────────────────────────────────
const newVersion = isMajor
  ? `${major}.${minor + 1}.0`
  : `${major}.${minor}.${patch + 1}`;

// ── Build new patch entry ──────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const newEntry = { version: newVersion, date: today, notes };

versionData.patches.unshift(newEntry);
versionData.version = newVersion;

writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n');

console.log(`\n✅  Bumped version: ${major}.${minor}.${patch}  →  ${newVersion}`);
notes.forEach(n => console.log(`    • ${n}`));
console.log();

// ── Build + Deploy ─────────────────────────────────────────────────────────
console.log('🔨  Building…');
execSync('npm run build', { stdio: 'inherit', cwd: join(__dirname, '..') });

console.log('\n🚀  Deploying to Firebase…');
execSync('npx firebase deploy --only hosting', { stdio: 'inherit', cwd: join(__dirname, '..') });

console.log(`\n🎉  Released v${newVersion} successfully!`);
