"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorCard } from "@/components/dashboard/state-views";
import { HERO_CONFIG, STATUS_CONFIG, faNum, faPercent, faRelative } from "@/lib/dashboard/constants";
import type { StudentSummary, StudentsResponse } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface StudentsTabProps {
  data?: StudentsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectStudent: (id: string) => void;
}

function heroClass(hero: string): string {
  return HERO_CONFIG[hero]?.className ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function heroLabel(hero: string): string {
  return HERO_CONFIG[hero]?.label ?? hero;
}

function weakFactClass(errorRate: number): string {
  return errorRate >= 0.4 ? "text-rose-600" : "text-amber-600";
}

function StudentRow({ student, onSelect }: { student: StudentSummary; onSelect: (id: string) => void }) {
  const status = STATUS_CONFIG[student.status];

  return (
    <TableRow
      className="cursor-pointer hover:bg-slate-50"
      onClick={() => onSelect(student.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(student.id);
        }
      }}
      aria-label={`مشاهدهٔ جزئیات ${student.name}`}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <span
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold", heroClass(student.hero))}
            aria-hidden
          >
            {student.name.trim().charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{student.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 px-1.5 py-0 text-[10px] text-slate-600">
                پایه {faNum(student.grade)}
              </Badge>
              <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", heroClass(student.hero))}>
                {heroLabel(student.hero)}
              </Badge>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm text-slate-700">{student.currentLayerName}</p>
        <p className="text-[11px] text-slate-400">لایهٔ {faNum(student.currentLayer)}</p>
      </TableCell>
      <TableCell className="min-w-36">
        <div className="flex items-center gap-2">
          <Progress
            value={student.progressPct}
            className="h-2 w-20 [&_[data-slot=progress-indicator]]:bg-emerald-500"
            aria-label={`پیشرفت ${student.name}`}
          />
          <span className="text-xs tabular-nums text-slate-600">{faNum(student.progressPct)}٪</span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          <span dir="ltr" className="tabular-nums">
            {faNum(student.masteredLayers)}/{faNum(9)}
          </span>{" "}
          لایه
        </p>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            student.accuracy7d === null
              ? "text-slate-400"
              : student.accuracy7d >= 0.9
                ? "text-emerald-600"
                : student.accuracy7d >= 0.75
                  ? "text-teal-600"
                  : student.accuracy7d >= 0.6
                    ? "text-amber-600"
                    : "text-rose-600"
          )}
        >
          {faPercent(student.accuracy7d, 1)}
        </span>
      </TableCell>
      <TableCell className="text-sm tabular-nums text-slate-700">{faNum(student.totalSessions)}</TableCell>
      <TableCell>
        {student.weakestFact ? (
          <div>
            <span dir="ltr" className="block font-mono text-sm text-slate-800">
              {student.weakestFact.fact}
            </span>
            <span className={cn("text-[11px] tabular-nums", weakFactClass(student.weakestFact.errorRate))}>
              خطای {faPercent(student.weakestFact.errorRate, 0)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("gap-1.5", status.badge)}>
          <span className={cn("inline-block size-1.5 rounded-full", status.dot)} aria-hidden />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap text-slate-500">{faRelative(student.lastActivity)}</TableCell>
    </TableRow>
  );
}

export function StudentsTab({ data, isLoading, isError, onRetry, onSelectStudent }: StudentsTabProps) {
  if (isError) {
    return <ErrorCard onRetry={onRetry} />;
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const students = data.students;

  if (students.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="هنوز دانش‌آموزی ثبت نشده است"
            description="با نخستین جلسهٔ بازی، دانش‌آموزان به‌صورت خودکار در داشبورد ساخته می‌شوند."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          دانش‌آموزان کلاس <span className="text-sm font-normal text-slate-400">({faNum(students.length)} نفر)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>دانش‌آموز</TableHead>
                <TableHead>لایهٔ جاری</TableHead>
                <TableHead>پیشرفت</TableHead>
                <TableHead>دقت ۷ روز</TableHead>
                <TableHead>جلسات</TableHead>
                <TableHead>ضعیف‌ترین فاکتور</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>آخرین فعالیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <StudentRow key={student.id} student={student} onSelect={onSelectStudent} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
