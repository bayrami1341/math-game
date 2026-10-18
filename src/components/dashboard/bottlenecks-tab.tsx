"use client";

import { useState } from "react";
import { AlertCircle, BatteryCharging, RadioTower, Rocket, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorBarClass } from "@/components/dashboard/accuracy-badge";
import { EmptyState, ErrorCard } from "@/components/dashboard/state-views";
import { SEVERITY_CONFIG, faNum, faPercent } from "@/lib/dashboard/constants";
import type { BottleneckItem, BottlenecksResponse } from "@/lib/dashboard/types";
import type { Remedy } from "@/lib/dashboard/remediation";
import { cn } from "@/lib/utils";

/** آیکون ماموریت‌های درمانی — هم‌راستا با SIDE_MISSIONS بازی */
const REMEDY_ICONS: Record<string, typeof RadioTower> = {
  "side-1-antenna": RadioTower,
  "side-2-backup": BatteryCharging,
  "side-3-fuel": Rocket,
};

function RemedyChip({ remedy }: { remedy: Remedy }) {
  const Icon = REMEDY_ICONS[remedy.missionId] ?? Rocket;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
      title={`مأموریت جانبی در بخش ${remedy.sectorHint} — ${remedy.objective}`}
    >
      <Icon className="size-3" aria-hidden />
      {remedy.title}
    </span>
  );
}

interface BottlenecksTabProps {
  data?: BottlenecksResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectStudent: (id: string) => void;
  onOpenAiReport: () => void;
}

function tableChipClass(errorRate: number): string {
  if (errorRate >= 0.4) return "bg-rose-100 text-rose-700 border-rose-200";
  if (errorRate >= 0.32) return "bg-orange-100 text-orange-700 border-orange-200";
  if (errorRate >= 0.25) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function AffectedDialog({
  bottleneck,
  onSelectStudent,
  onOpenChange,
}: {
  bottleneck: BottleneckItem | null;
  onSelectStudent: (id: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!bottleneck} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            دانش‌آموزان درگیر فاکتور{" "}
            {bottleneck ? (
              <span dir="ltr" className="font-mono text-emerald-700">
                {bottleneck.fact}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            با انتخاب نام هر دانش‌آموز، پروندهٔ کامل او در پنل جزئیات باز می‌شود.
          </DialogDescription>
        </DialogHeader>
        {bottleneck && bottleneck.affected.length > 0 ? (
          <ul className="max-h-80 space-y-2.5 overflow-y-auto pr-1 custom-scroll">
            {bottleneck.affected.map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm font-medium text-slate-800 underline-offset-4 hover:text-emerald-700 hover:underline"
                  onClick={() => {
                    onOpenChange(false);
                    onSelectStudent(person.id);
                  }}
                >
                  {person.name}
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full", errorBarClass(person.errorRate))}
                      style={{ width: `${Math.max(3, Math.round(person.errorRate * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {faNum(person.attempts)} تلاش
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                  {faPercent(person.errorRate, 1)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="دانش‌آموزی برای این فاکتور ثبت نشده است" />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BottlenecksTab({
  data,
  isLoading,
  isError,
  onRetry,
  onSelectStudent,
  onOpenAiReport,
}: BottlenecksTabProps) {
  const [selected, setSelected] = useState<BottleneckItem | null>(null);

  if (isError) {
    return <ErrorCard onRetry={onRetry} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* نوار توضیح */}
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <p className="text-xs leading-6 text-amber-800 sm:text-sm">
            فاکتورهایی که نرخ خطای کلاس در آن‌ها ≥ ٪۲۵ و حداقل ۵ تلاش است — مرتب بر اساس شدت
          </p>
        </div>
        <Button
          size="sm"
          onClick={onOpenAiReport}
          className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Sparkles className="size-4" aria-hidden />
          گزارش هوشمند
        </Button>
      </div>

      {/* خلاصهٔ جدول‌ها به‌صورت چیپ */}
      {data.tables.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.tables.map((table) => (
            <span
              key={table.table}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                tableChipClass(table.errorRate)
              )}
            >
              جدول {faNum(table.table)}
              <span className="tabular-nums">— {faPercent(table.errorRate, 0)}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* جدول گلوگاه‌ها */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            گلوگاه‌های یادگیری کلاس{" "}
            <span className="text-sm font-normal text-slate-400">({faNum(data.bottlenecks.length)} فاکتور)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.bottlenecks.length === 0 ? (
            <EmptyState
              title="گلوگاه فعالی وجود ندارد"
              description="نرخ خطای همهٔ فاکتورها زیر آستانهٔ هشدار است — کار کلاس رو به جلو است."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>فاکتور</TableHead>
                    <TableHead>جدول‌ها</TableHead>
                    <TableHead className="min-w-28">نرخ خطا</TableHead>
                    <TableHead>تلاش‌ها</TableHead>
                    <TableHead>دانش‌آموزان</TableHead>
                    <TableHead>شدت</TableHead>
                    <TableHead className="min-w-48">اقدام پیشنهادی</TableHead>
                    <TableHead className="text-left">افراد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bottlenecks.map((item) => {
                    const severity = SEVERITY_CONFIG[item.severity];
                    return (
                      <TableRow key={item.fact} className="hover:bg-slate-50/70">
                        <TableCell>
                          <span dir="ltr" className="block font-mono text-base font-bold text-slate-900">
                            {item.fact}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.tables.map((table) => (
                              <Badge
                                key={`${item.fact}-${table}`}
                                variant="outline"
                                className="border-slate-200 bg-slate-50 px-1.5 py-0 text-[10px] text-slate-600"
                              >
                                جدول {faNum(table)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn("h-full rounded-full", severity.bar)}
                                style={{ width: `${Math.max(3, Math.round(item.errorRate * 100))}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-slate-700">
                              {faPercent(item.errorRate, 1)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums text-slate-700">{faNum(item.attempts)}</TableCell>
                        <TableCell className="text-sm tabular-nums text-slate-700">
                          {faNum(item.students)} نفر
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severity.badge}>
                            {severity.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-64 text-xs leading-6 text-slate-600">
                          {item.remedy ? (
                            <div className="space-y-1.5">
                              <RemedyChip remedy={item.remedy} />
                              <p>{item.recommendation}</p>
                            </div>
                          ) : (
                            item.recommendation
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setSelected(item)}
                          >
                            <Search className="size-3.5" aria-hidden />
                            مشاهدهٔ دانش‌آموزان
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AffectedDialog
        bottleneck={selected}
        onSelectStudent={onSelectStudent}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
