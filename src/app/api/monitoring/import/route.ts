import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

function normalizeHeader(h: string): string {
  return h.toString().trim().toLowerCase().replace(/[_\-/()]/g, ' ').replace(/\s+/g, ' ').trim();
}

const HEADER_KEYWORDS = ['no', 'nama', 'name', 'alamat', 'address', 'kabupaten', 'kecamatan', 'kelurahan', 'kode', 'code', 'status', 'date', 'tanggal', 'provinsi', 'region', 'city', 'location', 'district', 'description', 'notes', 'type', 'category', 'index', 'id'];

function findHeaderRow(allRows: any[][]): number {
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
    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  return bestRow;
}

/** Build a unique fingerprint for a row based on customData. */
function buildRowFingerprint(customData: string): string {
  try {
    const cd = JSON.parse(customData);
    const sorted = Object.entries(cd).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`);
    return sorted.join('|');
  } catch { return customData; }
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa import data' }, { status: 403 });
    }

    // ═══ Detect request format: JSON (client-parsed) or FormData (file upload) ═══
    const contentType = request.headers.get('content-type') || '';

    let rows: Record<string, any>[] = [];
    let mode = 'replace';
    let projectId = '';
    let fileName = 'import.xlsx';

    if (contentType.includes('application/json')) {
      // ─── Client-side parsed JSON (bypasses Vercel 4.5MB limit) ───
      const body = await request.json();
      rows = body.rows || [];
      mode = body.mode || 'replace';
      projectId = body.projectId || getProjectId(request.url);
      fileName = body.fileName || 'import.xlsx';
    } else {
      // ─── Legacy FormData file upload (for small files < 4MB) ───
      const formData = await request.formData();
      const file = formData.get('file') as File;
      mode = formData.get('mode') as string || 'replace';
      projectId = (formData.get('projectId') as string) || getProjectId(request.url);
      fileName = file?.name || 'import.xlsx';

      if (!file) {
        return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileNameLower = fileName.toLowerCase();

      if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt')) {
        const text = buffer.toString('utf-8');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { return NextResponse.json({ error: 'File CSV kosong atau hanya 1 baris' }, { status: 400 }); }
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        let sep = ',';
        if (semiCount > commaCount && semiCount > tabCount) sep = ';';
        else if (tabCount > commaCount) sep = '\t';
        function parseCSVLine(line: string, separator: string): string[] {
          const result: string[] = []; let current = ''; let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) { if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; } else if (ch === '"') { inQuotes = false; } else { current += ch; } }
            else { if (ch === '"') { inQuotes = true; } else if (ch === separator) { result.push(current.trim()); current = ''; } else { current += ch; } }
          }
          result.push(current.trim()); return result;
        }
        const csvRows: string[][] = lines.map(l => parseCSVLine(l, sep));
        const headerLineIdx = findHeaderRow(csvRows);
        const headers = parseCSVLine(lines[headerLineIdx], sep);
        for (let i = headerLineIdx + 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep);
          if (vals.every(v => v === '')) continue;
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
          rows.push(obj);
        }
      } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const headerIdx = findHeaderRow(allRows);
        const headers = allRows[headerIdx].map(h => String(h).trim());
        for (let i = headerIdx + 1; i < allRows.length; i++) {
          const vals = allRows[i];
          if (!vals || vals.every(v => String(v).trim() === '')) continue;
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
          rows.push(obj);
        }
      } else {
        return NextResponse.json({ error: 'Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls' }, { status: 400 });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data ditemukan dalam file' }, { status: 400 });
    }

    // ALL columns from data become custom columns (no base field mapping)
    const fileHeaders = Object.keys(rows[0]);

    if (mode === 'replace') {
      await db.monitoringRow.deleteMany({ where: { projectId } });
      await db.customColumn.deleteMany({ where: { projectId } });
    }

    // --- DEDUPLICATION: build fingerprint set from existing rows (append mode) ---
    let existingFingerprints = new Set<string>();
    if (mode === 'append') {
      const existingRows = await db.monitoringRow.findMany({
        where: { projectId },
        select: { customData: true },
      });
      for (const r of existingRows) {
        existingFingerprints.add(buildRowFingerprint(r.customData || '{}'));
      }
    }

    // Create CustomColumn records for ALL headers
    const existingCustomCols = await db.customColumn.findMany({ where: { projectId } });
    const customColMap: Record<string, string> = {};

    for (let i = 0; i < fileHeaders.length; i++) {
      const h = fileHeaders[i];
      const colName = h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (!colName || colName.startsWith('__empty')) continue;
      let existing = existingCustomCols.find(c => c.name === colName || c.label === h);
      if (!existing) {
        existing = await db.customColumn.create({
          data: { projectId, name: colName, label: h, order: existingCustomCols.length + i + 1 },
        });
      }
      customColMap[h] = existing.name;
    }

    // --- Save original column order to Project.columnOrder ---
    const columnOrder: string[] = [];
    for (const h of fileHeaders) {
      if (customColMap[h]) {
        columnOrder.push(customColMap[h]);
      }
    }
    if (projectId && projectId !== 'default') {
      await db.project.update({
        where: { id: projectId },
        data: { columnOrder: JSON.stringify(columnOrder) },
      });
    } else {
      await db.project.upsert({
        where: { id: 'default' },
        update: { columnOrder: JSON.stringify(columnOrder) },
        create: { id: 'default', name: 'Default Project', columnOrder: JSON.stringify(columnOrder) },
      });
    }

    let startOrder = 1;
    if (mode === 'append') {
      const maxOrder = await db.monitoringRow.findFirst({ where: { projectId }, orderBy: { orderNum: 'desc' }, select: { orderNum: true } });
      startOrder = (maxOrder?.orderNum || 0) + 1;
    }

    // Build insert data
    const insertData: any[] = [];
    let skipped = 0;
    let orderIdx = 0;

    for (const row of rows) {
      const customData: Record<string, string> = {};
      for (const [srcHeader, colName] of Object.entries(customColMap)) {
        customData[colName] = String(row[srcHeader] ?? '').trim();
      }

      if (mode === 'append') {
        const fp = buildRowFingerprint(JSON.stringify(customData));
        if (existingFingerprints.has(fp)) { skipped++; continue; }
        existingFingerprints.add(fp);
      }

      insertData.push({
        projectId,
        orderNum: startOrder + orderIdx,
        customData: JSON.stringify(customData),
      });
      orderIdx++;
    }

    const BATCH_SIZE = 50;
    let inserted = 0;
    for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
      const batch = insertData.slice(i, i + BATCH_SIZE);
      await db.monitoringRow.createMany({ data: batch });
      inserted += batch.length;
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'IMPORT',
        tableName: 'MonitoringRow',
        newValue: JSON.stringify({
          file: fileName,
          mode,
          rows: inserted,
          skipped,
          totalColumns: Object.keys(customColMap).length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      totalInFile: rows.length,
      mode,
      mapping: Object.fromEntries(Object.entries(customColMap).map(([src, colId]) => [src, colId])),
      totalCustomColsCreated: Object.keys(customColMap).length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal import: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}
