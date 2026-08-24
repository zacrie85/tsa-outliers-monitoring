import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import * as crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'Password minimal 4 karakter' }, { status: 400 });
    }

    await db.user.update({
      where: { id: userId },
      data: { password: hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}
