"use client";

import { Crown, Trophy } from "lucide-react";
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
import { HERO_CONFIG, faNum, faPercent, faRelative } from "@/lib/dashboard/constants";
import type { LeaderboardResponse } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface LeaderboardTabProps {
  data?: LeaderboardResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function rankStyle(rank: number): string {
  if (rank === 1) return "border-amber-300 bg-amber-50/60";
  if (rank === 2) return "border-slate-300 bg-slate-50/60";
  if (rank === 3) return "border-orange-200 bg-orange-50/50";
  return "";
}

export function LeaderboardTab({ data, isLoading, isError, onRetry }: LeaderboardTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorCard title="خطا در بارگذاری جدول قهرمانان" onRetry={onRetry} />;
  }

  const leaders = data?.leaders ?? [];
  if (!leaders.length) {
    return (
      <EmptyState
        icon={<Trophy className="size-10 text-amber-500" aria-hidden />}
        title="هنوز قهرمانی روی تخته نیست"
        description="پس از نخستین جلسهٔ بازی دانش‌آموزان، رتبه‌های کلاس همین‌جا روشن می‌شود."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-5 text-amber-500" aria-hidden />
          جدول قهرمانان کلاس — {faNum(data?.totalStudents ?? leaders.length)} دانش‌آموز
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">رتبه</TableHead>
              <TableHead>دانش‌آموز</TableHead>
              <TableHead className="min-w-36">پیشرفت ایستگاه</TableHead>
              <TableHead className="text-center">دقت کل</TableHead>
              <TableHead className="text-center">جلسه‌ها</TableHead>
              <TableHead className="text-center">سؤال‌ها</TableHead>
              <TableHead className="text-center">آخرین فعالیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.map((row) => (
              <TableRow key={row.id} className={cn(rankStyle(row.rank))}>
                <TableCell className="text-center text-lg">
                  {MEDALS[row.rank - 1] ?? faNum(row.rank)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.rank === 1 ? (
                      <Crown className="size-4 text-amber-500" aria-hidden />
                    ) : null}
                    <span className="font-medium">{row.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {HERO_CONFIG[row.hero]?.label ?? row.hero}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={row.progressPct} className="h-2" aria-label={`پیشرفت ${row.name}`} />
                    <span className="w-12 text-xs text-slate-500">{faPercent(row.progressPct)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm">
                  {row.overallAccuracy === null ? "—" : faPercent(row.overallAccuracy)}
                </TableCell>
                <TableCell className="text-center text-sm">{faNum(row.totalSessions)}</TableCell>
                <TableCell className="text-center text-sm">{faNum(row.totalQuestions)}</TableCell>
                <TableCell className="text-center text-xs text-slate-500">
                  {row.lastActivity ? faRelative(row.lastActivity) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
