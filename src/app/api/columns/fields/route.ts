import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

// Base field definitions — the default columns that every project inherits.
// These are the original TSA monitoring columns.
const BASE_FIELDS = [
  { key: 'provinsi', label: 'Provinsi', isNumeric: false },
  { key: 'kabupaten', label: 'Kabupaten', isNumeric: false },
  { key: 'kecamatan', label: 'Kecamatan', isNumeric: false },
  { key: 'kelurahan', label: 'Kelurahan', isNumeric: false },
  { key: 'kelRwSiteName', label: 'Kel RW/Site Name', isNumeric: false },
  { key: 'desaPerum', label: 'Desa/Perum', isNumeric: false },
  { key: 'categoryBak', label: 'Category BAK', isNumeric: false },
  { key: 'klasifikasiTsa', label: 'Klasifikasi TSA', isNumeric: false },
  { key: 'picTsa', label: 'PIC TSA', isNumeric: false },
  { key: 'remarksTsa', label: 'Remarks TSA', isNumeric: false },
  { key: 'remarksJlm', label: 'Remarks JLM', isNumeric: false },
  { key: 'indexNum', label: 'No', isNumeric: true },
  { key: 'homepass', label: 'Homepass', isNumeric: true },
  { key: 'odp', label: 'ODP', isNumeric: true },
];

// GET /api/columns/fields?projectId=xxx
// Returns all available field definitions for a project (base + custom columns)
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const projectId = getProjectId(request.url);

    // Dynamically import db to avoid crashes in environments where DB isn't ready
    const { db } = await import('@/lib/db');

    let customFields: { key: string; label: string; isNumeric: boolean }[] = [];
    try {
      const cols = await db.customColumn.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        select: { name: true, label: true },
      });
      customFields = cols.map(c => ({
        key: c.name,
        label: c.label,
        // Custom columns store values as strings in customData JSON
        // We can't know if they're numeric without sampling data,
        // so we try to detect from label hints or default to false
        isNumeric: false,
      }));
    } catch {
      // Table might not be ready yet — just return base fields
    }

    // Detect numeric custom columns by sampling a few rows
    if (customFields.length > 0) {
      try {
        const sampleRows = await db.monitoringRow.findMany({
          where: { projectId },
          take: 50,
          select: { customData: true },
        });
        if (sampleRows.length > 0) {
          customFields = customFields.map(f => {
            // Sample values for this field
            const values = sampleRows
              .map(r => { try { return JSON.parse(r.customData || '{}')[f.key]; } catch { return null; } })
              .filter(v => v !== null && v !== undefined && v !== '');
            // If more than 50% of non-empty values are parseable numbers, treat as numeric
            if (values.length >= 2) {
              const numCount = values.filter(v => !isNaN(Number(v))).length;
              if (numCount / values.length > 0.5) {
                return { ...f, isNumeric: true };
              }
            }
            return f;
          });
        }
      } catch {
        // Ignore sampling errors
      }
    }

    const fields = [...BASE_FIELDS, ...customFields];
    return NextResponse.json({ fields });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    // Return base fields as fallback so UI never breaks
    return NextResponse.json({ fields: BASE_FIELDS });
  }
}
