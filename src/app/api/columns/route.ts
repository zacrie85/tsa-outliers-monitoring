import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const columns = await db.customColumn.findMany({
      orderBy: { order: 'asc' },
      include: { division: true },
    });
    return NextResponse.json({ columns });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal memuat kolom' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { name, label, divisionId } = await request.json();

    const maxOrder = await db.customColumn.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const column = await db.customColumn.create({
      data: {
        name,
        label,
        divisionId: divisionId || null,
        order: (maxOrder?.order || 0) + 1,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'COL_ADD',
        tableName: 'CustomColumn',
        newValue: JSON.stringify({ name, label, divisionId }),
      },
    });

    return NextResponse.json({ column });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menambah kolom' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { id, label, divisionId, isLocked, order } = await request.json();

    const existing = await db.customColumn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Kolom tidak ditemukan' }, { status: 404 });
    }

    const column = await db.customColumn.update({
      where: { id },
      data: { label, divisionId, isLocked, order },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: isLocked ? 'COL_LOCK' : 'COL_UNLOCK',
        tableName: 'CustomColumn',
        rowId: id,
        colLabel: existing.label,
        oldValue: String(existing.isLocked),
        newValue: String(isLocked),
      },
    });

    return NextResponse.json({ column });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah kolom' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    }

    const existing = await db.customColumn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Kolom tidak ditemukan' }, { status: 404 });
    }

    await db.customColumn.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'COL_DELETE',
        tableName: 'CustomColumn',
        rowId: id,
        colLabel: existing.label,
        oldValue: JSON.stringify(existing),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus kolom' }, { status: 500 });
  }
}
