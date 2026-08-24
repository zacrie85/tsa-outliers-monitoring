import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/auth';
import * as crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, username: true, name: true, role: true, divisionId: true, division: { select: { id: true, name: true, color: true } }, createdAt: true },
    });
    return NextResponse.json({ users });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    return NextResponse.json({ error: 'Gagal memuat pengguna' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const _user = await requireAdmin();
    const { username, name, password, role, divisionId } = await request.json();

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        username,
        name,
        password: hashPassword(password),
        role: role || 'EDITOR',
        divisionId: divisionId || null,
      },
      include: { division: true },
    });

    return NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role, divisionId: user.divisionId, division: user.division } });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal membuat pengguna' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 });
    }
    // Prevent self-deletion
    if (id === currentUser.id) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
    }
    const targetUser = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    // Delete associated audit logs first
    await db.auditLog.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'USER_DELETE',
        tableName: 'User',
        newValue: JSON.stringify({ deletedId: id, deletedName: targetUser.name, deletedRole: targetUser.role }),
      },
    });
    return NextResponse.json({ success: true, message: `Pengguna "${targetUser.name}" berhasil dihapus` });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal menghapus pengguna' }, { status: 500 });
  }
}
