import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const counts = { js: 0, html: 0, assets: 0, migrations: 0 };

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = await walk(root);
const relative = (file) => path.relative(root, file).split(path.sep).join('/');

for (const file of files.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))) {
  counts.js++;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`JavaScript syntax: ${relative(file)}\n${result.stderr || result.stdout}`);
}

for (const file of files.filter((f) => f.endsWith('.html'))) {
  counts.html++;
  const html = await readFile(file, 'utf8');
  const ids = [...html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map((m) => m[2]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) failures.push(`Duplicate HTML id in ${relative(file)}: ${id}`);
    seen.add(id);
  }
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
    const raw = match[2].trim();
    if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) continue;
    const local = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
    if (!local) continue;
    counts.assets++;
    try { await access(path.resolve(path.dirname(file), local)); }
    catch { failures.push(`Missing local asset in ${relative(file)}: ${raw}`); }
  }
}

const migrationDir = path.join(root, 'supabase', 'migrations');
const migrationFiles = (await readdir(migrationDir)).filter((f) => f.endsWith('.sql'));
counts.migrations = migrationFiles.length;
for (const name of migrationFiles) {
  if (!/^\d{3}_[a-z0-9_]+\.sql$/i.test(name)) {
    failures.push(`Migration filename does not follow NNN_name.sql: ${name}`);
  }
}

console.log(`Connect static checks: ${counts.js} JS/MJS, ${counts.html} HTML, ${counts.assets} local asset references, ${counts.migrations} migrations.`);
if (failures.length) {
  console.error(`\n${failures.length} issue(s) found:`);
  for (const failure of failures) console.error(`\n- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS: JavaScript syntax, HTML IDs, local asset references, and migration naming.');
}
