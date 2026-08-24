import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('session_user');

    if (!userCookie?.value) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
  }
}