// Regenerates src/components/Company/logoMap.json from the filenames actually
// present in public/logo/, so the map can never drift from what's on disk -
// add or rename a logo file and re-run this instead of hand-editing the JSON.
//
// Key derivation: filename without extension, underscores -> spaces, lowercased.
// e.g. "Texas_Instruments.png" -> key "texas instruments".
//
// Usage: npm run logos:sync

const fs = require('fs');
const path = require('path');

const LOGO_DIR = path.join(__dirname, '..', 'public', 'logo');
const OUT_FILE = path.join(__dirname, '..', 'src', 'components', 'Company', 'logoMap.json');

const files = fs.readdirSync(LOGO_DIR).filter(f => /\.(png|jpe?g|svg|webp)$/i.test(f));

const map = {};
for (const file of files) {
  const key = path.basename(file, path.extname(file)).replace(/_/g, ' ').toLowerCase().trim();
  if (map[key]) {
    console.warn(`Duplicate logo key "${key}" - "${map[key]}" is being overwritten by "/logo/${file}"`);
  }
  map[key] = `/logo/${file}`;
}

const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT_FILE, JSON.stringify(sorted, null, 2) + '\n');
console.log(`Wrote ${Object.keys(sorted).length} entries to ${path.relative(process.cwd(), OUT_FILE)}`);
