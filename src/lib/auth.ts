import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
  divisionId: string | null;
  divisionName: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('session_user');
    if (!userCookie?.value) return null;
    return JSON.parse(userCookie.value);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN');
  }
  return user;
}