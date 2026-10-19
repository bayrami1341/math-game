"use client";

import { AlertTriangle, CalendarCheck, HeartPulse, Target, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { faNum, faPercent } from "@/lib/dashboard/constants";
import type { Kpis } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  kpis?: Kpis;
}

interface KpiItem {
  label: string;
  sub: string;
  value: string;
  valueClass?: string;
  icon: React.ReactNode;
  iconWrap: string;
}

function buildItems(kpis: Kpis): KpiItem[] {
  const bottleneckActive = kpis.activeBottlenecks > 0;

  return [
    {
      label: "دانش‌آموزان",
      sub: "کلاس فعال",
      value: faNum(kpis.students),
      icon: <Users className="size-5" aria-hidden />,
      iconWrap: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "جلسات امروز",
      sub: "جلسهٔ کامل‌شده",
      value: faNum(kpis.sessionsToday),
      icon: <CalendarCheck className="size-5" aria-hidden />,
      iconWrap: "bg-teal-100 text-teal-600",
    },
    {
      label: "دقت ۷ روز اخیر",
      sub: "میانگین کلاس",
      value: faPercent(kpis.accuracy7d, 1),
      icon: <Target className="size-5" aria-hidden />,
      iconWrap: "bg-emerald-100 text-teal-600",
    },
    {
      label: "گلوگاه‌های فعال",
      sub: "فاکتور نیازمند تدریس مجدد",
      value: faNum(kpis.activeBottlenecks),
      valueClass: bottleneckActive ? "text-amber-600" : "text-slate-900",
      icon: <AlertTriangle className="size-5" aria-hidden />,
      iconWrap: bottleneckActive ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500",
    },
    {
      label: "نیازمند توجه",
      sub: "دانش‌آموز",
      value: faNum(kpis.attentionStudents),
      icon: <HeartPulse className="size-5" aria-hidden />,
      iconWrap: "bg-rose-100 text-rose-600",
    },
  ];
}

export function KpiCards({ kpis }: KpiCardsProps) {
  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {buildItems(kpis).map((item) => (
        <Card key={item.label} className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", item.iconWrap)}>
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className={cn("text-xl font-bold leading-7 text-slate-900", item.valueClass)}>{item.value}</p>
              <p className="truncate text-xs text-slate-500">{item.label}</p>
              <p className="truncate text-[11px] text-slate-400">{item.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
