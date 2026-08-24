import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { rowId, colKey, value, colLabel, isCustomCol, isLocked, colDivisionId } = await request.json();

    // Check if column is locked
    if (isLocked) {
      return NextResponse.json({ error: 'Kolom ini dikunci oleh admin' }, { status: 403 });
    }

    // Check permissions for custom columns
    if (isCustomCol && user.role !== 'ADMIN') {
      if (colDivisionId && colDivisionId !== user.divisionId) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses ke kolom ini' }, { status: 403 });
      }
    }

    // For non-admin, check if it's a base column they can edit
    const editableBaseCols = ['remarksTsa', 'klasifikasiTsa', 'picTsa'];
    if (!isCustomCol && user.role !== 'ADMIN' && !editableBaseCols.includes(colKey)) {
      return NextResponse.json({ error: 'Anda tidak bisa mengedit kolom ini' }, { status: 403 });
    }

    const row = await db.monitoringRow.findUnique({ where: { id: rowId } });
    if (!row) {
      return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 });
    }

    let oldValue: string | null = null;

    if (isCustomCol) {
      const customData = JSON.parse(row.customData || '{}');
      oldValue = customData[colKey] || null;
      customData[colKey] = value;
      await db.monitoringRow.update({
        where: { id: rowId },
        data: { customData: JSON.stringify(customData) },
      });
    } else {
      oldValue = String(row[colKey as keyof typeof row] ?? '');
      const updateData: Record<string, any> = {};
      if (colKey === 'indexNum' || colKey === 'homepass' || colKey === 'odp') {
        updateData[colKey] = parseInt(value) || 0;
      } else {
        updateData[colKey] = value;
      }
      await db.monitoringRow.update({
        where: { id: rowId },
        data: updateData,
      });
    }

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