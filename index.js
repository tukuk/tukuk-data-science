/**
 * tukuk-data-science — Entry point
 * Runs data analysis and statistical summaries for Tukuk-OS.
 *
 * Usage:
 *   node index.js                 → print summary stats
 *   node index.js --report        → generate full report
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── helpers ──────────────────────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function topN(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// ── data loaders ─────────────────────────────────────────────────────────────

function loadJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

// ── statistical analysis ─────────────────────────────────────────────────────

function analyseDatasets(dir = path.join(__dirname, 'data')) {
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    : [];

  const report = {
    generated: new Date().toISOString(),
    totalDatasets: files.length,
    datasets: []
  };

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const rows = Array.isArray(raw) ? raw : (raw.results || raw.hits || []);
      const stat = {
        file,
        rows: rows.length,
        fields: rows.length ? Object.keys(rows[0]) : []
      };

      // numeric field stats
      if (rows.length) {
        const numFields = stat.fields.filter(k => typeof rows[0][k] === 'number');
        stat.numeric = {};
        for (const f of numFields) {
          const vals = rows.map(r => r[f]).filter(v => Number.isFinite(v));
          stat.numeric[f] = { mean: mean(vals), median: median(vals), stddev: stddev(vals), min: Math.min(...vals), max: Math.max(...vals) };
        }
      }
      report.datasets.push(stat);
    } catch (e) {
      report.datasets.push({ file, error: e.message });
    }
  }
  return report;
}

// ── content statistics ────────────────────────────────────────────────────────

function contentStats(contentDir) {
  if (!fs.existsSync(contentDir)) return null;
  const categories = {};
  let total = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) {
        total++;
        const cat = path.relative(contentDir, dir).split(path.sep)[0] || 'root';
        categories[cat] = (categories[cat] || 0) + 1;
      }
    }
  }
  walk(contentDir);

  return {
    totalMarkdownFiles: total,
    topCategories: topN(categories, 15),
    categoryCount: Object.keys(categories).length
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isReport = args.includes('--report');

console.log('=== Tukuk-OS Data Science ===\n');

// Dataset analysis
const dsReport = analyseDatasets();
console.log(`Datasets found: ${dsReport.totalDatasets}`);

if (isReport) {
  const outPath = path.join(__dirname, 'reports', `report-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dsReport, null, 2));
  console.log(`\nFull report saved → ${outPath}`);
} else {
  console.log('\nTip: Run with --report to generate a full JSON report.');
}

console.log('\nDone.');
