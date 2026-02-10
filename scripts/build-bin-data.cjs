#!/usr/bin/env node
/**
 * Converts the 374K-entry bin-list-data.csv (27MB) into a compact JSON lookup (~3-5MB).
 * Output: public/bin-data.json
 * 
 * Format: { "424242": { "b": "VISA", "t": "CREDIT", "c": "CLASSIC", "i": "JPMORGAN CHASE", "co": "US" }, ... }
 * 
 * Usage: node scripts/build-bin-data.cjs /path/to/bin-list-data.csv
 */

const fs = require('fs');
const path = require('path');

const csvPath = process.argv[2] || path.join(__dirname, '..', 'bin-list-data.csv');
const outPath = path.join(__dirname, '..', 'public', 'bin-data.json');

if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
}

console.log(`Reading CSV from: ${csvPath}`);
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim());

// Parse header
const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
console.log(`Headers: ${headers.join(', ')}`);
console.log(`Total rows: ${lines.length - 1}`);

// Column indices
const idxBIN = headers.indexOf('BIN');
const idxBrand = headers.indexOf('Brand');
const idxType = headers.indexOf('Type');
const idxCategory = headers.indexOf('Category');
const idxIssuer = headers.indexOf('Issuer');
const idxIsoCode2 = headers.indexOf('isoCode2');
const idxCountry = headers.indexOf('CountryName');

if (idxBIN === -1) {
    console.error('BIN column not found in CSV');
    process.exit(1);
}

const result = {};
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse — handles quoted fields with commas
    const cols = [];
    let current = '';
    let inQuotes = false;

    for (const ch of lines[i]) {
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            cols.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    cols.push(current.trim());

    const bin = cols[idxBIN];
    if (!bin || bin.length < 4) {
        skipped++;
        continue;
    }

    const brand = cols[idxBrand] || '';
    const type = cols[idxType] || '';
    const category = cols[idxCategory] || '';
    const issuer = cols[idxIssuer] || '';
    const country = cols[idxIsoCode2] || '';

    // Only store if we have meaningful data
    if (brand || type || issuer) {
        const entry = {};
        if (brand) entry.b = brand;
        if (type) entry.t = type;
        if (category) entry.c = category;
        if (issuer) entry.i = issuer;
        if (country) entry.co = country;
        result[bin] = entry;
    } else {
        skipped++;
    }
}

const json = JSON.stringify(result);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, json);

const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
console.log(`\nGenerated: ${outPath}`);
console.log(`Entries: ${Object.keys(result).length}`);
console.log(`Skipped: ${skipped}`);
console.log(`File size: ${sizeMB} MB`);
