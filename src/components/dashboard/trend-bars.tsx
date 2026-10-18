"use client";

import { cn } from "@/lib/utils";
import { faNum, faPercent } from "@/lib/dashboard/constants";
import type { TrendPoint } from "@/lib/dashboard/types";

interface TrendBarsProps {
  data: TrendPoint[];
  /** ارتفاع ناحیهٔ میله‌ها */
  heightClass?: string;
  /** هر چند روز یک‌بار لیبل نمایش داده شود */
  labelEvery?: number;
  className?: string;
}

/**
 * نمودار میله‌ای CSS خالص برای روند دقت روزانه.
 * میله‌های emerald برای روزهای دارای داده؛ میلهٔ خاکری کوتاه خط‌چین برای روزهای بدون داده.
 * جهت زمان چپ‌به‌راست است (dir=ltr) و tooltip بومی مرورگر نمایش داده می‌شود.
 */
export function TrendBars({
  data,
  heightClass = "h-28",
  labelEvery = 2,
  className,
}: TrendBarsProps) {
  const hasAnyData = data.some((p) => p.accuracy !== null);

  return (
    <div className={cn("w-full", className)}>
      <div dir="ltr" className={cn("flex items-end gap-1", heightClass)}>
        {data.map((point, index) => {
          const tooltip =
            point.accuracy === null
              ? `${point.label} — بدون داده`
              : `${point.label} — دقت ${faPercent(point.accuracy, 1)} · ${faNum(point.questions)} سؤال در ${faNum(point.sessions)} جلسه`;
          return (
            <div
              key={point.date}
              title={tooltip}
              className="group flex h-full min-w-0 flex-1 cursor-default flex-col justify-end"
            >
              {point.accuracy === null ? (
                <div className="mx-auto h-1.5 w-full max-w-7 rounded-sm border border-dashed border-slate-300 bg-slate-100 transition-colors group-hover:border-slate-400" />
              ) : (
                <div
                  className={cn(
                    "w-full rounded-t-sm bg-emerald-500 transition-all group-hover:bg-emerald-600",
                    !hasAnyData && "bg-slate-300"
                  )}
                  style={{ height: `${Math.max(4, Math.round(point.accuracy * 100))}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div dir="ltr" className="mt-1.5 flex gap-1">
        {data.map((point, index) => (
          <div key={point.date} className="min-w-0 flex-1 text-center">
            <span
              className={cn(
                "block truncate text-[10px] leading-4 text-slate-400",
                index % labelEvery !== labelEvery - 1 && "invisible"
              )}
            >
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendLegend({ className }: { className?: string }) {
  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500", className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
        روز دارای جلسه
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-slate-300 bg-slate-100"
          aria-hidden
        />
        بدون داده
      </span>
      <span>ارتفاع میله = دقت همان روز</span>
    </div>
  );
}
