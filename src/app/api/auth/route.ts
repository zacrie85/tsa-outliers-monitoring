import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import * as crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const user = await db.user.findUnique({
      where: { username },
      include: { division: true },
    });

    if (!user || user.password !== hashPassword(password)) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    // Create session token
    const token = crypto.createHash('sha256').update(`${user.id}-${Date.now()}`).digest('hex');

    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    cookieStore.set('session_user', JSON.stringify({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      divisionId: user.divisionId,
      divisionName: user.division?.name || null,
    }), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Log login
    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'LOGIN',
        tableName: 'User',
      }
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        divisionId: user.divisionId,
        divisionName: user.division?.name || null,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session_token');
    cookieStore.delete('session_user');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}