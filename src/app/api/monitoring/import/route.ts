import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

const BASE_FIELD_MAP: Record<string, { key: string; type: 'string' | 'number' }> = {
  'no': { key: 'orderNum', type: 'number' },
  'order': { key: 'orderNum', type: 'number' },
  'ordernum': { key: 'orderNum', type: 'number' },
  'category bak': { key: 'categoryBak', type: 'string' },
  'category_bak': { key: 'categoryBak', type: 'string' },
  'categorybak': { key: 'categoryBak', type: 'string' },
  'provinsi': { key: 'provinsi', type: 'string' },
  'province': { key: 'provinsi', type: 'string' },
  'kabupaten': { key: 'kabupaten', type: 'string' },
  'kabupaten/kota': { key: 'kabupaten', type: 'string' },
  'city': { key: 'kabupaten', type: 'string' },
  'kecamatan': { key: 'kecamatan', type: 'string' },
  'district': { key: 'kecamatan', type: 'string' },
  'kelurahan': { key: 'kelurahan', type: 'string' },
  'kel': { key: 'kelurahan', type: 'string' },
  'kelurahan/desa': { key: 'kelurahan', type: 'string' },
  'village': { key: 'kelurahan', type: 'string' },
  'kel rw/site name': { key: 'kelRwSiteName', type: 'string' },
  'kel_rw_site_name': { key: 'kelRwSiteName', type: 'string' },
  'kelrw/sitename': { key: 'kelRwSiteName', type: 'string' },
  'site name': { key: 'kelRwSiteName', type: 'string' },
  'sitename': { key: 'kelRwSiteName', type: 'string' },
  'desa/perum': { key: 'desaPerum', type: 'string' },
  'desa_perum': { key: 'desaPerum', type: 'string' },
  'desa': { key: 'desaPerum', type: 'string' },
  'perum': { key: 'desaPerum', type: 'string' },
  'index': { key: 'indexNum', type: 'number' },
  'indexnum': { key: 'indexNum', type: 'number' },
  'index num': { key: 'indexNum', type: 'number' },
  'homepass': { key: 'homepass', type: 'number' },
  'home pass': { key: 'homepass', type: 'number' },
  'odp': { key: 'odp', type: 'number' },
  'remarks tsa': { key: 'remarksTsa', type: 'string' },
  'remarkstsa': { key: 'remarksTsa', type: 'string' },
  'klasifikasi tsa': { key: 'klasifikasiTsa', type: 'string' },
  'klasifikasitsa': { key: 'klasifikasiTsa', type: 'string' },
  'pic tsa': { key: 'picTsa', type: 'string' },
  'pictsa': { key: 'picTsa', type: 'string' },
  'remarks jlm': { key: 'remarksJlm', type: 'string' },
  'remarksjlm': { key: 'remarksJlm', type: 'string' },
};

const HEADER_KEYWORDS = ['no', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'homepass', 'odp', 'category', 'index', 'remarks', 'klasifikasi', 'pic', 'desa', 'site'];

function normalizeHeader(h: string): string {
  return h.toString().trim().toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ');
}

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

function autoDetectMapping(headers: string[]): {
  baseMap: Record<string, string>;
  customHeaders: string[];
} {
  const baseMap: Record<string, string> = {};
  const customHeaders: string[] = [];
  const usedFields = new Set<string>();

  for (const h of headers) {
    const norm = normalizeHeader(h);
    const match = BASE_FIELD_MAP[norm];
    if (match && !usedFields.has(match.key)) {
      baseMap[h] = match.key;
      usedFields.add(match.key);
    }
  }

  for (const h of headers) {
    if (baseMap[h]) continue;
    const norm = normalizeHeader(h);
    let bestMatch: string | null = null;
    let bestLen = 0;
    for (const [key, val] of Object.entries(BASE_FIELD_MAP)) {
      if (usedFields.has(val.key)) continue;
      if (norm.includes(key) || key.includes(norm)) {
        if (key.length > bestLen) {
          bestLen = key.length;
          bestMatch = val.key;
        }
      }
    }
    if (bestMatch) {
      baseMap[h] = bestMatch;
      usedFields.add(bestMatch);
    }
  }

  for (const h of headers) {
    if (!baseMap[h]) {
      customHeaders.push(h);
    }
  }

  return { baseMap, customHeaders };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa import data' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'replace';
    const projectId = (formData.get('projectId') as string) || getProjectId(request.url);

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: Record<string, any>[] = [];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        return NextResponse.json({ error: 'File CSV kosong atau hanya 1 baris' }, { status: 400 });
      }

      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semiCount = (firstLine.match(/;/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      let sep = ',';
      if (semiCount > commaCount && semiCount > tabCount) sep = ';';
      else if (tabCount > commaCount) sep = '\t';

      function parseCSVLine(line: string, separator: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { current += ch; }
          } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === separator) { result.push(current.trim()); current = ''; }
            else { current += ch; }
          }
        }
        result.push(current.trim());
        return result;
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
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
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

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data ditemukan dalam file' }, { status: 400 });
    }

    const fileHeaders = Object.keys(rows[0]);
    const { baseMap, customHeaders } = autoDetectMapping(fileHeaders);

    if (mode === 'replace') {
      await db.monitoringRow.deleteMany({ where: { projectId } });
      await db.customColumn.deleteMany({ where: { projectId } });
    }

    const existingCustomCols = await db.customColumn.findMany({ where: { projectId } });
    const customColMap: Record<string, string> = {};

    for (let i = 0; i < customHeaders.length; i++) {
      const h = customHeaders[i];
      const colName = h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (!colName || colName.startsWith('__empty')) continue;
      let existing = existingCustomCols.find(c => c.name === colName || c.label === h);
      if (!existing) {
        existing = await db.customColumn.create({
          data: { name: colName, label: h, order: existingCustomCols.length + i + 1 },
        });
      }
      customColMap[h] = existing.id;
    }

    let startOrder = 1;
    if (mode === 'append') {
      const maxOrder = await db.monitoringRow.findFirst({ where: { projectId }, orderBy: { orderNum: 'desc' }, select: { orderNum: true } });
      startOrder = (maxOrder?.orderNum || 0) + 1;
    }

    const insertData = rows.map((row, idx) => {
      const data: any = {
        projectId,
        orderNum: startOrder + idx,
        categoryBak: '',
        provinsi: '',
        kabupaten: '',
        kecamatan: '',
        kelurahan: '',
        kelRwSiteName: '',
        desaPerum: '',
        indexNum: 0,
        homepass: 0,
        odp: 0,
        remarksTsa: '',
        klasifikasiTsa: '',
        picTsa: '',
        remarksJlm: '',
      };

      for (const [srcHeader, fieldKey] of Object.entries(baseMap)) {
        const val = String(row[srcHeader] ?? '').trim();
        const fieldInfo = Object.values(BASE_FIELD_MAP).find(f => f.key === fieldKey);
        if (fieldInfo?.type === 'number') {
          data[fieldKey] = parseInt(val) || 0;
        } else {
          data[fieldKey] = val;
        }
      }

      const customData: Record<string, string> = {};
      for (const [srcHeader, colId] of Object.entries(customColMap)) {
        customData[colId] = String(row[srcHeader] ?? '').trim();
      }
      data.customData = JSON.stringify(customData);

      return data;
    });

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
          file: file.name,
          mode,
          rows: inserted,
          baseColumns: Object.keys(baseMap),
          customColumns: Object.keys(customColMap),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      inserted,
      mode,
      mapping: {
        baseColumns: Object.fromEntries(Object.entries(baseMap).map(([src, field]) => [src, field])),
        customColumns: Object.fromEntries(Object.entries(customColMap).map(([src, colId]) => [src, colId])),
      },
      totalCustomColsCreated: customHeaders.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Gagal import: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}
