import "dotenv/config";
import pg from "pg";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DIRECT_URL or DATABASE_URL in .env");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const QUERIES = {
  tables: `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_prisma%'
    ORDER BY table_name;
  `,
  enums: `
    SELECT t.typname AS enum_name,
           array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
  `,
  indexes: `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `,
  foreignKeys: `
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `,
  migrationHistory: `
    SELECT migration_name, finished_at, applied_steps_count
    FROM _prisma_migrations
    ORDER BY finished_at;
  `,
  rlsStatus: `
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE '_prisma%'
    ORDER BY c.relname;
  `,
  monetaryColumns: `
    SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'numeric'
    ORDER BY table_name, column_name;
  `,
  softDeleteColumns: `
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'deleted_at'
    ORDER BY table_name;
  `,
  fkWithoutIndex: `
    SELECT
      c.conrelid::regclass::text AS table_name,
      a.attname AS column_name,
      c.conname AS constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND a.attnum = ANY (i.indkey)
      )
    ORDER BY 1, 2;
  `,
};

async function main() {
  await client.connect();
  const report = { generatedAt: new Date().toISOString(), projectRef: process.env.SUPABASE_PROJECT_REF ?? null };

  for (const [key, sql] of Object.entries(QUERIES)) {
    try {
      const result = await client.query(sql);
      report[key] = result.rows;
    } catch (error) {
      report[key] = { error: error.message };
    }
  }

  report.summary = {
    tableCount: Array.isArray(report.tables) ? report.tables.length : 0,
    enumCount: Array.isArray(report.enums) ? report.enums.length : 0,
    indexCount: Array.isArray(report.indexes) ? report.indexes.length : 0,
    foreignKeyCount: Array.isArray(report.foreignKeys) ? report.foreignKeys.length : 0,
    softDeleteTableCount: Array.isArray(report.softDeleteColumns) ? report.softDeleteColumns.length : 0,
    monetaryColumnCount: Array.isArray(report.monetaryColumns) ? report.monetaryColumns.length : 0,
    rlsEnabledTables: Array.isArray(report.rlsStatus)
      ? report.rlsStatus.filter((r) => r.rls_enabled).map((r) => r.table_name)
      : [],
    fkColumnsMissingIndex: Array.isArray(report.fkWithoutIndex) ? report.fkWithoutIndex : [],
  };

  const outPath = resolve(__dirname, "../docs/supabase-catalog-snapshot.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nFull snapshot written to ${outPath}`);
  await client.end();
}

main().catch(async (error) => {
  console.error(error.message);
  try {
    await client.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
