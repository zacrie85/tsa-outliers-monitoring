import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa akses' }, { status: 403 });
    }

    const before = await db.customColumn.findMany({ select: { id: true, name: true, label: true } });

    // Delete all custom columns that start with __empty or have empty names
    const deleteResult = await db.customColumn.deleteMany({
      where: {
        OR: [
          { name: { startsWith: '__empty' } },
          { name: '' },
          { label: { startsWith: '__EMPTY' } },
        ],
      },
    });

    // Also clean up any customData JSON in rows that references deleted columns
    // by removing keys that reference non-existent custom columns
    const remainingCols = await db.customColumn.findMany({ select: { id: true } });
    const validIds = new Set(remainingCols.map(c => c.id));

    const allRows = await db.monitoringRow.findMany({ select: { id: true, customData: true } });
    let cleanedRows = 0;

    for (const row of allRows) {
      if (!row.customData) continue;
      try {
        const data = JSON.parse(row.customData as string) as Record<string, string>;
        const keys = Object.keys(data);
        const hasInvalid = keys.some(k => !validIds.has(k));
        if (hasInvalid) {
          const cleaned: Record<string, string> = {};
          for (const [k, v] of Object.entries(data)) {
            if (validIds.has(k)) cleaned[k] = v;
          }
          await db.monitoringRow.update({
            where: { id: row.id },
            data: { customData: JSON.stringify(cleaned) },
          });
          cleanedRows++;
        }
      } catch {
        // invalid JSON, skip
      }
    }

    const after = await db.customColumn.findMany({ select: { id: true, name: true, label: true } });

    return NextResponse.json({
      success: true,
      deletedColumns: deleteResult.count,
      cleanedRows,
      before: before.map(c => ({ name: c.name, label: c.label })),
      after: after.map(c => ({ name: c.name, label: c.label })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Gagal cleanup: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}
