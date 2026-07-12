#!/usr/bin/env node
/**
 * generate-gallery.js
 *
 * Scans images/gallery/, reads each image's dimensions, classifies them
 * by orientation, then arranges them smartly in the editorial grid and
 * injects the HTML into gallery.html between the GALLERY:START / GALLERY:END markers.
 *
 * Usage:
 *   node tools/generate-gallery.js
 *
 * Drop any .jpg / .jpeg / .png / .webp into images/gallery/ first.
 */

const fs   = require('fs');
const path = require('path');
const { imageSize } = require('image-size');

const GALLERY_DIR  = path.join(__dirname, '..', 'images', 'gallery');
const GALLERY_HTML = path.join(__dirname, '..', 'gallery.html');
const START_MARKER = '<!-- GALLERY:START -->';
const END_MARKER   = '<!-- GALLERY:END -->';

// ── 1. Read all images and classify by orientation ───────────────────────────

const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const files = fs.readdirSync(GALLERY_DIR)
  .filter(f => EXTENSIONS.has(path.extname(f).toLowerCase()))
  .sort(); // alphabetical → consistent order between runs

if (!files.length) {
  console.log('No images found in images/gallery/. Add some photos and re-run.');
  process.exit(0);
}

const classified = { landscape: [], portrait: [], square: [] };

for (const file of files) {
  const full = path.join(GALLERY_DIR, file);
  try {
    const { width, height } = imageSize(full);
    const ratio = width / height;
    const src   = `images/gallery/${file}`;
    const entry = { src, file, width, height, ratio };

    if (ratio >= 1.25)      classified.landscape.push(entry); // wide
    else if (ratio <= 0.85) classified.portrait.push(entry);  // tall
    else                    classified.square.push(entry);    // square-ish
  } catch (e) {
    console.warn(`  Skipping ${file}: ${e.message}`);
  }
}

console.log(`Found: ${classified.landscape.length} landscape, ${classified.portrait.length} portrait, ${classified.square.length} square`);

// ── 2. Build slot sequence ───────────────────────────────────────────────────
//
// The CSS uses nth-child to size items in repeating groups of 9:
//   position 1 → feature  (2×2) — best for landscape
//   position 4 → tall     (1×2) — best for portrait
//   position 7 → wide     (2×1) — best for landscape
//   positions 2,3,5,6,8,9 → standard (1×1) — any
//
// We'll build an ordered list of images that respects these slots.

const slots = [
  'feature',   // 1  — landscape preferred
  'standard',  // 2
  'standard',  // 3
  'tall',      // 4  — portrait preferred
  'standard',  // 5
  'standard',  // 6
  'wide',      // 7  — landscape preferred
  'standard',  // 8
  'standard',  // 9
];

const total = files.length;
const ordered = [];

// Queues (mutable copies)
const L = [...classified.landscape];
const P = [...classified.portrait];
const S = [...classified.square];

// Helper: pop from preferred queue, fall back to others
function pick(...queues) {
  for (const q of queues) {
    if (q.length) return q.shift();
  }
  return null;
}

// Build slot sequence for all images
for (let i = 0; i < total; i++) {
  const slot = slots[i % slots.length];
  let img = null;

  if (slot === 'feature' || slot === 'wide') {
    img = pick(L, S, P);
  } else if (slot === 'tall') {
    img = pick(P, S, L);
  } else {
    img = pick(S, P, L);
  }

  if (img) ordered.push(img);
}

// ── 3. Generate HTML ─────────────────────────────────────────────────────────

const indent = '        '; // 8 spaces to match gallery.html indentation
const lines  = [`${indent}<!-- GALLERY:START -->`];

for (const img of ordered) {
  const alt = 'Abbie and Asante';
  lines.push(`${indent}<div class="gallery-grid__item">`);
  lines.push(`${indent}  <img src="${img.src}" alt="${alt}" loading="lazy" />`);
  lines.push(`${indent}</div>`);
}

lines.push(`${indent}<!-- GALLERY:END -->`);
const replacement = lines.join('\n');

// ── 4. Inject into gallery.html ──────────────────────────────────────────────

let html = fs.readFileSync(GALLERY_HTML, 'utf8');
const startIdx = html.indexOf(START_MARKER);
const endIdx   = html.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find GALLERY:START / GALLERY:END markers in gallery.html');
  process.exit(1);
}

html = html.slice(0, startIdx) + replacement + html.slice(endIdx + END_MARKER.length);
fs.writeFileSync(GALLERY_HTML, html, 'utf8');

console.log(`✓ gallery.html updated with ${ordered.length} photos.`);
console.log(`  Layout: ${Math.ceil(total / 9)} cycle(s) of the editorial grid.`);
