#!/usr/bin/env node
// Convert a backup exported by the previous Django implementation into the Graf format.
// Usage: node scripts/convert-django-backup.mjs django-export.json > graf-backup.json
import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/convert-django-backup.mjs <django-export.json>');
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(input, 'utf8'));
} catch (e) {
  console.error('Failed to parse ' + input + ': ' + e.message);
  process.exit(1);
}

const list = Array.isArray(raw) ? raw : Array.isArray(raw.pages) ? raw.pages : [];
const PATH_RE = /^[A-Za-z0-9]{8,32}$/;

const pages = list
  .filter((n) => n && typeof n === 'object')
  .map((n) => ({
    path: n.hashcode || n.path || '',
    title: n.title || '',
    author: n.author || '',
    content: n.content || '',
    link_target: n.link_target === '_blank' ? '_blank' : '_self',
    edit_token: n.edit_token || '',
    views: Number.isFinite(n.views) ? Math.max(0, Math.floor(n.views)) : 0,
    created_at: n.created_at || new Date().toISOString(),
    updated_at: n.updated_at || n.created_at || new Date().toISOString(),
  }))
  .filter((p) => PATH_RE.test(p.path));

process.stdout.write(JSON.stringify({
  format: 'graf-backup',
  version: 1,
  exportedAt: new Date().toISOString(),
  pages,
  comments: [],
}, null, 2) + '\n');
