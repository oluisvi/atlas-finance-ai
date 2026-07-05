import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = resolve(
  root,
  "prisma/migrations/20260624000100_init_supabase_schema/migration.sql",
);

const sql = readFileSync(migrationPath, "utf8");

const enums = [...sql.matchAll(/^CREATE TYPE "([^"]+)" AS ENUM \(([^)]+)\);/gm)].map(
  ([, name, values]) => ({
    enum_name: name,
    labels: [...values.matchAll(/'([^']+)'/g)].map((m) => m[1]),
  }),
);

const tables = [...sql.matchAll(/^CREATE TABLE "([^"]+)"/gm)].map((m) => ({
  table_name: m[1],
}));

const indexes = [...sql.matchAll(/^CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\(([^)]+)\);/gm)].map(
  ([, unique, indexname, tablename, columns]) => ({
    tablename,
    indexname,
    unique: Boolean(unique),
    columns: columns.replace(/"/g, ""),
  }),
);

const foreignKeys = [
  ...sql.matchAll(
    /^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)"\("([^"]+)"\)/gm,
  ),
].map(([, table_name, constraint_name, column_name, foreign_table_name, foreign_column_name]) => ({
  table_name,
  constraint_name,
  column_name,
  foreign_table_name,
  foreign_column_name,
}));

const softDeleteColumns = tables
  .filter((t) => {
    const block = sql.match(new RegExp(`CREATE TABLE "${t.table_name}" \\([\\s\\S]*?\\);`));
    return block && block[0].includes('"deleted_at"');
  })
  .map((t) => ({ table_name: t.table_name, column_name: "deleted_at" }));

const monetaryColumns = [];
for (const table of tables) {
  const block = sql.match(new RegExp(`CREATE TABLE "${table.table_name}" \\([\\s\\S]*?\\);`));
  if (!block) continue;
  for (const match of block[0].matchAll(/"([^"]+)" DECIMAL\((\d+),(\d+)\)/g)) {
    monetaryColumns.push({
      table_name: table.table_name,
      column_name: match[1],
      numeric_precision: Number(match[2]),
      numeric_scale: Number(match[3]),
    });
  }
}

const fkColumns = new Set(foreignKeys.map((fk) => `${fk.table_name}.${fk.column_name}`));
const indexedFkColumns = new Set();
for (const idx of indexes) {
  for (const col of idx.columns.split(",").map((c) => c.trim())) {
    indexedFkColumns.add(`${idx.tablename}.${col}`);
  }
}

const fkWithoutIndex = foreignKeys
  .filter((fk) => !indexedFkColumns.has(`${fk.table_name}.${fk.column_name}`))
  .map((fk) => ({
    table_name: fk.table_name,
    column_name: fk.column_name,
    constraint_name: fk.constraint_name,
  }));

const report = {
  generatedAt: new Date().toISOString(),
  source: "migration_file",
  migration: "20260624000100_init_supabase_schema",
  summary: {
    tableCount: tables.length,
    enumCount: enums.length,
    indexCount: indexes.length,
    foreignKeyCount: foreignKeys.length,
    softDeleteTableCount: softDeleteColumns.length,
    monetaryColumnCount: monetaryColumns.length,
    fkColumnsMissingIndex: fkWithoutIndex,
  },
  tables,
  enums,
  indexes,
  foreignKeys,
  softDeleteColumns,
  monetaryColumns,
};

const outPath = resolve(root, "docs/expected-catalog-from-migration.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log(`\nWritten to ${outPath}`);
