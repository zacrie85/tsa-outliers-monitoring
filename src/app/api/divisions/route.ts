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
    const division = await db.division.create({ data: { name, color: color || '#6366f1' } });
    await db.auditLog.create({
      data: { userId: user.id, userName: user.name, action: 'DIVISION_ADD', tableName: 'Division', newValue: name },
    });
    return NextResponse.json({ division });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
    return NextResponse.json({ error: 'Gagal menambah divisi' }, { status: 500 });
  }
}
