// GET /api/bottlenecks — گزارش گلوگاه‌های یادگیری کلاس
// v2: آستانه‌های به‌روز موتور آماری

import { NextResponse } from 'next/server';
import { loadDashboardData } from '@/lib/dashboard/server';
import { computeBottlenecks, computeTableHealth } from '@/lib/dashboard/stats';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadDashboardData(30);
  const bottlenecks = computeBottlenecks(data.questions, data.studentsById);
  return NextResponse.json({
    bottlenecks,
    tables: computeTableHealth(data.questions),
    generatedAt: new Date().toISOString(),
  });
}
