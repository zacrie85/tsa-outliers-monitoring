import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const divisions = await db.division.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, columns: true } } },
    });
    return NextResponse.json({ divisions });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal memuat divisi' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { name, color } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nama divisi wajib diisi' }, { status: 400 });
    }
    const division = await db.division.create({ data: { name: name.trim(), color: color || '#6366f1' } });
    await db.auditLog.create({
      data: { userId: user.id, userName: user.name, action: 'DIVISION_ADD', tableName: 'Division', newValue: name.trim() },
    });
    return NextResponse.json({ division });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    if (error.code === 'P2002') return NextResponse.json({ error: 'Nama divisi sudah ada' }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menambah divisi' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { id, name, color } = await request.json();
    if (!id || !name?.trim()) {
      return NextResponse.json({ error: 'ID dan nama divisi wajib diisi' }, { status: 400 });
    }
    const division = await db.division.update({
      where: { id },
      data: { name: name.trim(), color: color || '#6366f1' },
    });
    await db.auditLog.create({
      data: { userId: user.id, userName: user.name, action: 'DIVISION_EDIT', tableName: 'Division', newValue: JSON.stringify({ id, name: name.trim(), color }) },
    });
    return NextResponse.json({ division });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    if (error.code === 'P2002') return NextResponse.json({ error: 'Nama divisi sudah ada' }, { status: 400 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Divisi tidak ditemukan' }, { status: 404 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah divisi' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID divisi wajib diisi' }, { status: 400 });
    }
    // Check references before deleting
    const div = await db.division.findUnique({
      where: { id },
      include: { _count: { select: { users: true, columns: true } } },
    });
    if (!div) {
      return NextResponse.json({ error: 'Divisi tidak ditemukan' }, { status: 404 });
    }
    // Unlink users from this division
    if (div._count.users > 0) {
      await db.user.updateMany({ where: { divisionId: id }, data: { divisionId: null } });
    }
    // Unlink custom columns from this division
    if (div._count.columns > 0) {
      await db.customColumn.updateMany({ where: { divisionId: id }, data: { divisionId: null } });
    }
    await db.division.delete({ where: { id } });
    await db.auditLog.create({
      data: { userId: user.id, userName: user.name, action: 'DIVISION_DELETE', tableName: 'Division', newValue: JSON.stringify({ id, name: div.name }) },
    });
    return NextResponse.json({ success: true, message: `Divisi "${div.name}" berhasil dihapus` });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus divisi' }, { status: 500 });
  }
}
