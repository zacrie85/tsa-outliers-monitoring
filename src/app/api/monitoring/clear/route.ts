import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function DELETE() {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menghapus data' }, { status: 403 });
    }

    const rowCounts = await db.monitoringRow.count();
    const colCounts = await db.customColumn.count();

    await db.$transaction([
      db.monitoringRow.deleteMany(),
      db.customColumn.deleteMany(),
    ]);

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'CLEAR_ALL',
        tableName: 'MonitoringRow + CustomColumn',
        newValue: JSON.stringify({
          deletedRows: rowCounts,
          deletedColumns: colCounts,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      deletedRows: rowCounts,
      deletedColumns: colCounts,
      message: `Berhasil menghapus ${rowCounts} baris data dan ${colCounts} kolom kustom`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }
    console.error('Clear data error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}
