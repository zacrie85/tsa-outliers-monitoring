import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

export async function GET(request: NextRequest) {
  try {
    const projectId = getProjectId(request.url);
    const columns = await db.customColumn.findMany({
      where: { projectId },
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
    const projectId = getProjectId(request.url);

    const maxOrder = await db.customColumn.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const column = await db.customColumn.create({
      data: {
        projectId,
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
    const { id, name, label, divisionId, isLocked, order } = await request.json();

    const existing = await db.customColumn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Kolom tidak ditemukan' }, { status: 404 });
    }

    // If name (key) is being changed, migrate all rows' customData
    if (name && name !== existing.name) {
      const allRows = await db.monitoringRow.findMany({
        where: { projectId: existing.projectId || 'default' },
        select: { id: true, customData: true },
      });
      const updates = allRows
        .filter(r => {
          try { return r.customData && JSON.parse(r.customData)[existing.name] !== undefined; }
          catch { return false; }
        })
        .map(r => {
          const cd = JSON.parse(r.customData || '{}');
          cd[name] = cd[existing.name];
          delete cd[existing.name];
          return { where: { id: r.id }, data: { customData: JSON.stringify(cd) } };
        });
      if (updates.length > 0) {
        await Promise.all(updates.map(u => db.monitoringRow.update(u)));
      }
    }

    const column = await db.customColumn.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        label, divisionId, isLocked, order,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'COL_EDIT',
        tableName: 'CustomColumn',
        rowId: id,
        colLabel: existing.label,
        oldValue: JSON.stringify({ name: existing.name, label: existing.label, divisionId: existing.divisionId }),
        newValue: JSON.stringify({ name: name || existing.name, label, divisionId }),
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
