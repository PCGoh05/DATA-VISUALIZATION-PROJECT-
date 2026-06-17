/**
 * preprocess.js
 * 
 * Reads the raw dataset (global_food_security_intelligence.csv) and produces
 * a cleaned, dashboard-ready file (food_security_clean.csv).
 *
 * Cleaning steps:
 *   1. Filter years to 2001–2022.
 *   2. Strip extra spaces from `region`.
 *   3. Keep only the 15 selected dashboard columns.
 *   4. Do NOT fill missing values with 0 — leave them empty.
 *   5. Write output to data/food_security_clean.csv.
 *
 * Usage:  node scripts/preprocess.js
 */

const fs = require('fs');
const path = require('path');

// ── Paths ──────────────────────────────────────────────────────────────────
const INPUT  = path.join(__dirname, '..', 'data', 'global_food_security_intelligence.csv');
const OUTPUT = path.join(__dirname, '..', 'data', 'food_security_clean.csv');

// ── Columns to keep ────────────────────────────────────────────────────────
const KEEP_COLUMNS = [
    'iso3',
    'country_name',
    'year',
    'region',
    'income_group',
    'population_total',
    'undernourishment_pct',
    'food_production_index',
    'cereal_yield_kg_per_ha',
    'agricultural_land_pct',
    'fao_dietary_energy_adequacy_pct',
    'fao_protein_supply_g_per_day',
    'undernourishment_yoy_change_pp',
    'hunger_severity_index',
    'food_crisis_flag'
];

// ── Year range ─────────────────────────────────────────────────────────────
const YEAR_MIN = 2001;
const YEAR_MAX = 2022;

// ── Parse CSV (simple, no external dependencies) ───────────────────────────
function parseCSV(text) {
    const lines = text.split('\n');
    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (values.length !== headers.length) continue;

        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j].trim()] = values[j];
        }
        rows.push(row);
    }
    return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted fields (which may contain commas).
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

// ── Write CSV ──────────────────────────────────────────────────────────────
function toCSV(headers, rows) {
    const lines = [headers.join(',')];
    for (const row of rows) {
        const values = headers.map(h => {
            const val = row[h] ?? '';
            // Quote values that contain commas
            if (String(val).includes(',')) {
                return `"${val}"`;
            }
            return val;
        });
        lines.push(values.join(','));
    }
    return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
    console.log('Reading raw dataset...');
    const raw = fs.readFileSync(INPUT, 'utf-8');
    const { rows } = parseCSV(raw);
    console.log(`  Raw rows: ${rows.length}`);

    // Verify required columns exist
    const missingCols = KEEP_COLUMNS.filter(c => !(c in rows[0]));
    if (missingCols.length > 0) {
        console.error(`ERROR: Missing columns in raw data: ${missingCols.join(', ')}`);
        process.exit(1);
    }

    // Filter and clean
    const cleaned = [];
    for (const row of rows) {
        // 1. Filter years
        const year = parseInt(row.year, 10);
        if (isNaN(year) || year < YEAR_MIN || year > YEAR_MAX) continue;

        // Skip rows without iso3
        if (!row.iso3 || row.iso3.trim() === '') continue;

        // 2. Strip extra spaces from region
        if (row.region) {
            row.region = row.region.trim();
        }

        // 3. Keep only selected columns (do NOT fill missing with 0)
        const cleanRow = {};
        for (const col of KEEP_COLUMNS) {
            cleanRow[col] = row[col] ?? '';
        }
        cleaned.push(cleanRow);
    }

    console.log(`  Cleaned rows: ${cleaned.length}`);
    console.log(`  Year range: ${YEAR_MIN}–${YEAR_MAX}`);
    console.log(`  Columns kept: ${KEEP_COLUMNS.length}`);

    // Count unique countries and regions
    const countries = new Set(cleaned.map(r => r.iso3));
    const regions = new Set(cleaned.map(r => r.region).filter(r => r));
    console.log(`  Unique countries (iso3): ${countries.size}`);
    console.log(`  Unique regions: ${regions.size}`);
    console.log(`  Regions: ${[...regions].sort().join(', ')}`);

    // 5. Write output
    const csv = toCSV(KEEP_COLUMNS, cleaned);
    fs.writeFileSync(OUTPUT, csv, 'utf-8');
    console.log(`\nCleaned dataset written to: ${OUTPUT}`);
    console.log('Done.');
}

main();
