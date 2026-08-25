import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/projects — list all projects
export async function GET() {
  try {
    await requireAuth();
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { rows: true, columns: true } },
      },
    });
    return NextResponse.json({ projects });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal memuat proyek' }, { status: 500 });
  }
}

// POST /api/projects — create new project
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { name, description, color } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama proyek diperlukan' }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#66bb6a',
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'PROJECT_CREATE',
        tableName: 'Project',
        rowId: project.id,
        colLabel: project.name,
        newValue: JSON.stringify({ name, description, color }),
      },
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal membuat proyek' }, { status: 500 });
  }
}

// PUT /api/projects — rename/update project
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { id, name, description, color } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(color ? { color } : {}),
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'PROJECT_UPDATE',
        tableName: 'Project',
        rowId: id,
        colLabel: existing.name,
        oldValue: JSON.stringify({ name: existing.name, description: existing.description, color: existing.color }),
        newValue: JSON.stringify({ name: name || existing.name, description, color }),
      },
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah proyek' }, { status: 500 });
  }
}

// DELETE /api/projects?id=xxx — delete project and all its data
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
    if (id === 'default') return NextResponse.json({ error: 'Proyek default tidak bisa dihapus' }, { status: 403 });

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Proyek tidak ditemukan' }, { status: 404 });

    // CASCADE will delete all related rows, columns, charts
    await db.project.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'PROJECT_DELETE',
        tableName: 'Project',
        rowId: id,
        colLabel: existing.name,
        oldValue: JSON.stringify(existing),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus proyek' }, { status: 500 });
  }
}
