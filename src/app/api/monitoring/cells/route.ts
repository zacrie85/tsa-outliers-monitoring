import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { rowId, colKey, value, colLabel, isLocked, colDivisionId } = await request.json();

    // Check if column is locked (only admin can edit locked columns)
    if (isLocked && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Kolom ini dikunci oleh admin' }, { status: 403 });
    }

    // VIEWER cannot edit
    if (user.role === 'VIEWER') {
      return NextResponse.json({ error: 'Viewer tidak bisa mengedit data' }, { status: 403 });
    }

    const row = await db.monitoringRow.findUnique({ where: { id: rowId } });
    if (!row) {
      return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 });
    }

    const customData = JSON.parse(row.customData || '{}');
    const oldValue = customData[colKey] || null;
    customData[colKey] = value;

    await db.monitoringRow.update({
      where: { id: rowId },
      data: { customData: JSON.stringify(customData) },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'CELL_EDIT',
        tableName: 'MonitoringRow',
        rowId,
        colKey,
        colLabel: colLabel || colKey,
        oldValue: oldValue ?? '',
        newValue: String(value ?? ''),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah data' }, { status: 500 });
  }
}
