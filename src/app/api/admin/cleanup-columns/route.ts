import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    }

    // List before delete
    const before = await db.customColumn.findMany({ orderBy: { order: 'asc' } });

    // Delete ALL custom columns
    const delCols = await db.customColumn.deleteMany({});

    // Clear customData from all rows
    const delData = await db.monitoringRow.updateMany({
      data: { customData: '{}' },
    });

    return NextResponse.json({
      success: true,
      deletedColumns: delCols.count,
      cleanedRows: delData.count,
      removedColumns: before.map(c => c.label),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
