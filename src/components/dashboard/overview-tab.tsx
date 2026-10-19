"use client";

import { Activity, BarChart3, ShieldCheck, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccuracyBadge, errorBarClass } from "@/components/dashboard/accuracy-badge";
import { TrendBars, TrendLegend } from "@/components/dashboard/trend-bars";
import { EmptyState, ErrorCard, SectionTitle } from "@/components/dashboard/state-views";
import { HERO_CONFIG, faNum, faPercent, faRelative } from "@/lib/dashboard/constants";
import type { OverviewResponse, TableHealth } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface OverviewTabProps {
  data?: OverviewResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** رنگ نوار خطای جدول بر اساس آستانه‌ها */
function tableBarClass(errorRate: number): string {
  return errorBarClass(errorRate);
}

function heroBadgeClass(hero: string): string {
  return HERO_CONFIG[hero]?.className ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function heroLabel(hero: string): string {
  return HERO_CONFIG[hero]?.label ?? hero;
}

const HERO_KEYS = Object.keys(HERO_CONFIG);

/** رنگ آواتار بر پایهٔ نام (تنوع پایدار از پالت HERO_CONFIG) */
function avatarClassForName(name: string): string {
  const key = HERO_KEYS[name.length % Math.max(1, HERO_KEYS.length)];
  return heroBadgeClass(key ?? "astronaut");
}

function TableHealthList({ rows }: { rows: TableHealth[] }) {
  if (rows.length === 0) {
    return <EmptyState title="داده‌ای برای سلامت جدول‌ها موجود نیست" />;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.table} className="flex items-center gap-3">
          <Badge variant="outline" className="w-20 justify-center shrink-0 border-slate-200 bg-slate-50 text-slate-700">
            جدول {faNum(row.table)}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full transition-all", tableBarClass(row.errorRate))}
                style={{ width: `${Math.max(3, Math.round(row.errorRate * 100))}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                بدترین:{" "}
                {row.worstFact ? (
                  <span dir="ltr" className="font-mono text-slate-700">
                    {row.worstFact}
                  </span>
                ) : (
                  "—"
                )}
              </span>
              <span className="tabular-nums">{faPercent(row.errorRate, 1)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ data, isLoading, isError, onRetry }: OverviewTabProps) {
  if (isError) {
    return <ErrorCard onRetry={onRetry} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="mt-2 h-4 w-40" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const sessions = data.recentSessions.slice(0, 8);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-emerald-600" aria-hidden />
            روند دقت کلاس — ۱۴ روز اخیر
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.trend.length === 0 ? (
            <EmptyState title="هنوز دادهٔ روندی ثبت نشده است" description="با برگزاری جلسات بازی، روند روزانهٔ دقت کلاس شکل می‌گیرد." />
          ) : (
            <>
              <TrendBars data={data.trend} />
              <TrendLegend />
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-teal-600" aria-hidden />
              سلامت جدول‌های ضرب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TableHealthList rows={data.tableHealth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-emerald-600" aria-hidden />
              فعالیت اخیر
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <EmptyState title="هنوز جلسه‌ای ثبت نشده است" description="جلسات کامل‌شدهٔ بازی دانش‌آموزان اینجا نمایش داده می‌شود." />
            ) : (
              <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1 custom-scroll">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                        avatarClassForName(session.studentName)
                      )}
                      aria-hidden
                    >
                      {session.studentName.trim().charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{session.studentName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {session.layerName} · {faNum(session.correct)} از {faNum(session.total)} پاسخ درست
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <AccuracyBadge accuracy={session.accuracy} />
                      <span className="text-[10px] text-slate-400">{faRelative(session.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-amber-500" aria-hidden />
            قهرمان‌های کلاس
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.heroDistribution.length === 0 ? (
            <EmptyState title="قهرمانی ثبت نشده است" />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {data.heroDistribution.map((entry) => (
                <Badge
                  key={entry.hero}
                  variant="outline"
                  className={cn("gap-2 px-3 py-1.5 text-sm", heroBadgeClass(entry.hero))}
                >
                  {heroLabel(entry.hero)}
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold tabular-nums">
                    {faNum(entry.count)}
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
