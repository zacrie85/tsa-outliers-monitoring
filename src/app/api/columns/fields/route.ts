import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

// GET /api/columns/fields?projectId=xxx
// Returns all available field definitions for a project (custom columns only)
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const projectId = getProjectId(request.url);

    const { db } = await import('@/lib/db');

    const cols = await db.customColumn.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: { name: true, label: true },
    });

    let fields = cols.map(c => ({
      key: c.name,
      label: c.label,
      isNumeric: false,
    }));

    // Detect numeric custom columns by sampling rows
    if (fields.length > 0) {
      try {
        const sampleRows = await db.monitoringRow.findMany({
          where: { projectId },
          take: 50,
          select: { customData: true },
        });
        if (sampleRows.length > 0) {
          fields = fields.map(f => {
            const values = sampleRows
              .map(r => { try { return JSON.parse(r.customData || '{}')[f.key]; } catch { return null; } })
              .filter(v => v !== null && v !== undefined && v !== '');
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

    return NextResponse.json({ fields });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ fields: [] });
  }
}
