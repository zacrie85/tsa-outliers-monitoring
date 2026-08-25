import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProjectId } from '@/lib/project-context';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const projectId = getProjectId(request.url);
    const charts = await db.chartConfig.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ charts });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal memuat chart' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { id, title, chartType, config, order } = await request.json();

    const chart = await db.chartConfig.update({
      where: { id },
      data: { title, chartType, config: JSON.stringify(config), order },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'CHART_UPDATE',
        tableName: 'ChartConfig',
        rowId: id,
        colLabel: title,
        newValue: JSON.stringify({ chartType, config }),
      },
    });

    return NextResponse.json({ chart });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengubah chart' }, { status: 500 });
  }
}
