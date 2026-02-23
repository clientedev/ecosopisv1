/**
 * One-time migration script to add missing carousel_items columns.
 * Run with: node fix_db.mjs
 * Then delete this file.
 */
import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = 'postgresql://postgres:tIrQzBYwBOacJhZPNDehIOoIfltenbBz@nozomi.proxy.rlwy.net:45826/railway';

const MISSING_COLUMNS = [
    ["alignment", "VARCHAR DEFAULT 'left'"],
    ["title_color", "VARCHAR DEFAULT '#ffffff'"],
    ["description_color", "VARCHAR DEFAULT '#ffffff'"],
    ["badge_color", "VARCHAR DEFAULT '#ffffff'"],
    ["badge_bg_color", "VARCHAR DEFAULT '#4a7c59'"],
    ["overlay_color", "VARCHAR DEFAULT '#000000'"],
    ["overlay_opacity", "DOUBLE PRECISION DEFAULT 0.3"],
];

async function run() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('✓ Connected to Railway PostgreSQL');

    for (const [col, def] of MISSING_COLUMNS) {
        try {
            await client.query(`ALTER TABLE carousel_items ADD COLUMN IF NOT EXISTS ${col} ${def}`);
            console.log(`✓ Column carousel_items.${col} ensured`);
        } catch (e) {
            console.error(`✗ Error on column ${col}:`, e.message);
        }
    }

    // Verify
    const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='carousel_items' ORDER BY ordinal_position`);
    console.log('\ncarousel_items columns now:', res.rows.map(r => r.column_name).join(', '));

    await client.end();
    console.log('\n✓ Migration complete!');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
