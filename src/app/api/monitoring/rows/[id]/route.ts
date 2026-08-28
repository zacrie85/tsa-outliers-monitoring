import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa mengubah baris' }, { status: 403 });
    }

    const existing = await db.monitoringRow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 });
    }

    const updated = await db.monitoringRow.update({
      where: { id },
      data: {
        customData: body.customData,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'ROW_UPDATE',
        tableName: 'MonitoringRow',
        rowId: id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(body),
      },
    });

    return NextResponse.json({ row: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah baris' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menghapus baris' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.monitoringRow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 });
    }

    await db.monitoringRow.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'ROW_DELETE',
        tableName: 'MonitoringRow',
        rowId: id,
        oldValue: JSON.stringify(existing),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus baris' }, { status: 500 });
  }
}