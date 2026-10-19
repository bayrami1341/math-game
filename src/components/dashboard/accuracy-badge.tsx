"use client";

import { cn } from "@/lib/utils";
import { faPercent, statusFromAccuracy } from "@/lib/dashboard/constants";

/** کلاس بج درصد دقت بر اساس آستانه‌های وضعیت (emerald/teal/amber/rose) */
export function accuracyClass(accuracy: number | null | undefined): string {
  const status = statusFromAccuracy(accuracy);
  switch (status) {
    case "excellent":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "good":
      return "bg-teal-100 text-teal-700 border-teal-200";
    case "practice":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "critical":
      return "bg-rose-100 text-rose-700 border-rose-200";
  }
}

/** کلاس نوار افقی نرخ خطا بر اساس آستانه‌ها (>=40% rose، >=32% orange، >=25% amber، else emerald) */
export function errorBarClass(errorRate: number): string {
  if (errorRate >= 0.4) return "bg-rose-500";
  if (errorRate >= 0.32) return "bg-orange-500";
  if (errorRate >= 0.25) return "bg-amber-400";
  return "bg-emerald-500";
}

interface AccuracyBadgeProps {
  accuracy: number | null | undefined;
  digits?: number;
  className?: string;
}

/** بج کوچک درصد دقت با رنگ‌بندی خودکار */
export function AccuracyBadge({ accuracy, digits = 0, className }: AccuracyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        accuracyClass(accuracy),
        className
      )}
    >
      {accuracy === null || accuracy === undefined ? "—" : faPercent(accuracy, digits)}
    </span>
  );
}
