const XLSX = require('xlsx');
const fs = require('fs');

const HEADER_KEYWORDS = ['no', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'homepass', 'odp', 'category', 'index', 'remarks', 'klasifikasi', 'pic', 'desa', 'site'];

function normalizeHeader(h) {
  return h.toString().trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
}

function findHeaderRow(allRows) {
  let bestRow = 0, bestScore = 0;
  for (let r = 0; r < Math.min(allRows.length, 10); r++) {
    const row = allRows[r];
    let score = 0;
    for (const cell of row) {
      const norm = normalizeHeader(String(cell));
      for (const kw of HEADER_KEYWORDS) {
        if (norm === kw || norm.includes(kw)) { score++; break; }
      }
    }
    console.log('Row', r, 'score:', score, '|', row.slice(0,5).join(', '));
    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  return bestRow;
}

const wb = XLSX.read(fs.readFileSync('upload/138 LIST OUTLIERS TSA 11 AGUSTUS 2026.xlsx'), {type:'buffer'});
const ws = wb.Sheets[wb.SheetNames[0]];
const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('Total rows:', allRows.length);
const headerIdx = findHeaderRow(allRows);
console.log('\n=== Detected header row:', headerIdx, '===');
console.log('Headers:', allRows[headerIdx]);
console.log('\n=== First 3 data rows ===');
for (let i = headerIdx + 1; i < Math.min(headerIdx + 4, allRows.length); i++) {
  console.log('Row', i - headerIdx, ':', allRows[i].slice(0, 8));
}
console.log('\nTotal data rows:', allRows.length - headerIdx - 1);
