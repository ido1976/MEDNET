/**
 * MEDNET Migration Runner
 *
 * Usage:
 *   node scripts/run-migration.js <database_password>
 *
 * Or set environment variable:
 *   DB_PASSWORD=your_password node scripts/run-migration.js
 *
 * Find your database password in Supabase Dashboard:
 *   Settings > Database > Connection string > password
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const REF = 'mpkbdnqwshkskbhnftwm';
const DB_PASSWORD = process.argv[2] || process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.log('MEDNET Migration Runner');
  console.log('======================\n');
  console.log('Database password required.\n');
  console.log('Option 1: Run with password argument:');
  console.log('  node scripts/run-migration.js YOUR_DB_PASSWORD\n');
  console.log('Option 2: Set environment variable:');
  console.log('  DB_PASSWORD=xxx node scripts/run-migration.js\n');
  console.log('Option 3: Run SQL manually in the Supabase Dashboard:');
  console.log(`  https://supabase.com/dashboard/project/${REF}/sql/new`);
  console.log('  Paste contents of: supabase/migrations/001_initial_schema.sql\n');
  console.log('Find your password at:');
  console.log(`  https://supabase.com/dashboard/project/${REF}/settings/database`);
  process.exit(1);
}

// Try multiple connection methods
const CONNECTIONS = [
  {
    name: 'Pooler (us-east-1)',
    url: `postgresql://postgres.${REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  },
  {
    name: 'Pooler (eu-central-1)',
    url: `postgresql://postgres.${REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  },
  {
    name: 'Direct',
    url: `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${REF}.supabase.co:5432/postgres`,
  },
];

async function main() {
  console.log('MEDNET Migration Runner\n');

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  let client = null;

  for (const conn of CONNECTIONS) {
    console.log(`Trying ${conn.name}...`);
    const c = new Client({
      connectionString: conn.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await c.connect();
      console.log(`  Connected!\n`);
      client = c;
      break;
    } catch (err) {
      console.log(`  Failed: ${err.message.slice(0, 60)}`);
    }
  }

  if (!client) {
    console.log('\nCould not connect. Check your password and try again.');
    process.exit(1);
  }

  try {
    console.log('Running migration...\n');
    await client.query(sql);

    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`Created ${rows.length} tables:`);
    rows.forEach(r => console.log(`  - ${r.table_name}`));
    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
