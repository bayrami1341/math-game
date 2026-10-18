"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BatteryCharging,
  CheckCircle2,
  ClipboardList,
  Gamepad2,
  Lightbulb,
  Loader2,
  Lock,
  RadioTower,
  Rocket,
  Route,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { AccuracyBadge, errorBarClass } from "@/components/dashboard/accuracy-badge";
import { TrendBars } from "@/components/dashboard/trend-bars";
import { EmptyState, SectionTitle } from "@/components/dashboard/state-views";
import { fetchStudentAssignments, fetchStudentDetail, postAssignment } from "@/components/dashboard/api";
import {
  HERO_CONFIG,
  STATUS_CONFIG,
  faNum,
  faPercent,
  faRelative,
} from "@/lib/dashboard/constants";
import type {
  AssignmentItem,
  AssignmentStatus,
  FactStat,
  StudentDetailResponse,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

/** آیکون ماموریت‌های درمانی — هم‌راستا با SIDE_MISSIONS بازی */
const REMEDY_ICONS: Record<string, typeof RadioTower> = {
  "side-1-antenna": RadioTower,
  "side-2-backup": BatteryCharging,
  "side-3-fuel": Rocket,
};

function RemedyCard({ detail }: { detail: StudentDetailResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const studentId = detail.student.id;
  const remedy = detail.recommendedRemedy;

  const sendMutation = useMutation({
    mutationFn: () =>
      postAssignment({
        studentId,
        missionId: remedy!.missionId,
        fact: detail.bottlenecks[0]?.fact ?? undefined,
      }),
    onSuccess: (data) => {
      toast({
        title: `مأموریت «${remedy!.title}» برای ${detail.student.name} ارسال شد`,
        description: data.duplicate
          ? "این مأموریت قبلاً در انتظار انجام بوده و رکورد تکراری ساخته نشد."
          : "به‌محض انجام مأموریت در بازی، وضعیت آن در بخش «مأموریت‌های معلم» به‌روز می‌شود.",
      });
      void queryClient.invalidateQueries({ queryKey: ["student-detail", studentId] });
      void queryClient.invalidateQueries({ queryKey: ["student-assignments", studentId] });
    },
    onError: () => {
      toast({
        title: "خطا در ارسال مأموریت",
        description: "ارسال مأموریت درمانی ناموفق بود. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    },
  });

  if (!remedy) return null;
  const Icon = REMEDY_ICONS[remedy.missionId] ?? Rocket;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600" aria-hidden>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
            <Gamepad2 className="size-3.5 shrink-0" aria-hidden />
            مأموریت درمانی در بازی: {remedy.title}
          </p>
          <p className="mt-1 text-xs leading-6 text-emerald-900/80">{remedy.objective}</p>
          <p className="mt-1 text-[11px] text-emerald-700">
            بخش {remedy.sectorHint} · تمرین جدول‌های {remedy.tablesCovered.map((t) => faNum(t)).join("، ")} · ۵ سؤال تطبیقی
          </p>
          <Button
            size="sm"
            type="button"
            disabled={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
            className="mt-3 min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 sm:w-fit"
          >
            {sendMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {sendMutation.isPending ? "در حال ارسال…" : "ارسال مأموریت به دانش‌آموز"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** بج وضعیت مأموریت معلم — پالت موجود بدون آبی */
const ASSIGNMENT_STATUS_CONFIG: Record<AssignmentStatus, { label: string; badge: string; dot: string }> = {
  pending: { label: "در انتظار انجام", badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  seen: { label: "دانش‌آموز دیده است", badge: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  completed: { label: "انجام شد", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

function AssignmentRow({ item }: { item: AssignmentItem }) {
  const cfg = ASSIGNMENT_STATUS_CONFIG[item.status] ?? ASSIGNMENT_STATUS_CONFIG.pending;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="text-sm font-semibold text-slate-800">{item.missionTitle}</p>
        <Badge variant="outline" className={cn("gap-1.5", cfg.badge)}>
          <span className={cn("inline-block size-1.5 rounded-full", cfg.dot)} aria-hidden />
          {cfg.label}
        </Badge>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {item.fact ? (
          <span dir="ltr" className="font-mono text-xs font-bold text-slate-700">
            {item.fact}
          </span>
        ) : null}
        <span className="tabular-nums">{faRelative(item.createdAt)}</span>
      </div>
      {item.note ? <p className="mt-1.5 text-xs leading-6 text-slate-600">{item.note}</p> : null}
    </li>
  );
}

/** بخش «مأموریت‌های معلم» — فقط وقتی حداقل یک مأموریت باشد نمایش داده می‌شود */
function TeacherAssignmentsSection({ studentId }: { studentId: string }) {
  const assignmentsQuery = useQuery({
    queryKey: ["student-assignments", studentId],
    queryFn: () => fetchStudentAssignments(studentId),
    enabled: !!studentId,
  });
  const assignments = assignmentsQuery.data?.assignments ?? [];

  if (assignmentsQuery.isLoading || assignments.length === 0) return null;

  return (
    <section aria-label="مأموریت‌های معلم">
      <SectionTitle icon={<ClipboardList className="size-4 text-emerald-600" aria-hidden />} className="mb-2">
        مأموریت‌های معلم
      </SectionTitle>
      <div className="max-h-96 space-y-2 overflow-y-auto custom-scroll pe-1">
        <ul className="space-y-2">
          {assignments.map((item) => (
            <AssignmentRow key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface StudentDetailSheetProps {
  studentId: string | null;
  onOpenChange: (open: boolean) => void;
}

function factErrorClass(errorRate: number): string {
  return errorBarClass(errorRate);
}

function FactRow({ fact }: { fact: FactStat }) {
  return (
    <li className="flex items-center gap-3">
      <span dir="ltr" className="w-14 shrink-0 text-center font-mono text-base font-bold text-slate-800">
        {fact.fact}
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full", factErrorClass(fact.errorRate))}
            style={{ width: `${Math.max(3, Math.round(fact.errorRate * 100))}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {faNum(fact.wrong)} اشتباه از {faNum(fact.attempts)} تلاش ({faPercent(fact.errorRate, 1)})
        </p>
      </div>
    </li>
  );
}

export function StudentDetailSheet({ studentId, onOpenChange }: StudentDetailSheetProps) {
  const detailQuery = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: () => fetchStudentDetail(studentId as string),
    enabled: !!studentId,
  });

  const detail = studentId ? detailQuery.data : undefined;
  const status = detail ? STATUS_CONFIG[detail.student.status] : null;
  const heroClass = detail
    ? (HERO_CONFIG[detail.student.hero]?.className ?? "bg-slate-100 text-slate-600 border-slate-200")
    : "";
  const heroLabel = detail ? (HERO_CONFIG[detail.student.hero]?.label ?? detail.student.hero) : "";

  return (
    <Sheet open={!!studentId} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full overflow-y-auto sm:max-w-xl custom-scroll"
      >
        {detailQuery.isLoading || !detail ? (
          <div className="space-y-4 p-1">
            <SheetTitle className="sr-only">در حال بارگذاری جزئیات دانش‌آموز</SheetTitle>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <SheetHeader className="p-0">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-full border text-lg font-bold",
                    heroClass
                  )}
                  aria-hidden
                >
                  {detail.student.name.trim().charAt(0)}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-bold text-slate-900">{detail.student.name}</SheetTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {status ? (
                      <Badge variant="outline" className={cn("gap-1.5", status.badge)}>
                        <span className={cn("inline-block size-1.5 rounded-full", status.dot)} aria-hidden />
                        {status.label}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className={heroClass}>
                      {heroLabel}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                      پایه {faNum(detail.student.grade)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    آخرین فعالیت: {faRelative(detail.student.lastActivity)} · مجموع {faNum(detail.student.totalSessions)} جلسه و{" "}
                    {faNum(detail.student.totalQuestions)} سؤال
                  </p>
                </div>
              </div>
            </SheetHeader>

            {/* مسیر ۹ لایهٔ عمق */}
            <section>
              <SectionTitle icon={<Route className="size-4 text-emerald-600" aria-hidden />} className="mb-2">
                مسیر ۹ لایهٔ عمق
              </SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {detail.layers.map((layer) => (
                  <div
                    key={layer.layer}
                    className={cn(
                      "relative rounded-xl border p-2.5 text-center transition-colors",
                      layer.mastered
                        ? "border-emerald-400 bg-emerald-50"
                        : layer.isCurrent
                          ? "ring-2 ring-emerald-500 border-emerald-300 bg-white"
                          : "border-slate-200 bg-slate-50"
                    )}
                  >
                    {layer.mastered ? (
                      <CheckCircle2 className="absolute top-1.5 left-1.5 size-3.5 text-emerald-500" aria-hidden />
                    ) : !layer.isCurrent ? (
                      <Lock className="absolute top-1.5 left-1.5 size-3 text-slate-300" aria-hidden />
                    ) : null}
                    <p className="text-[10px] font-medium text-slate-400">لایهٔ {faNum(layer.layer)}</p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-xs font-semibold",
                        layer.mastered || layer.isCurrent ? "text-slate-800" : "text-slate-400"
                      )}
                      title={layer.name}
                    >
                      {layer.short}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[11px] tabular-nums",
                        layer.accuracy === null ? "text-slate-300" : "text-emerald-600"
                      )}
                    >
                      {layer.accuracy === null ? "—" : faPercent(layer.accuracy, 0)}
                    </p>
                    {layer.isCurrent ? (
                      <Badge className="mt-1.5 bg-emerald-600 px-1.5 py-0 text-[10px] text-white hover:bg-emerald-600">
                        جاری
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* روند دقت */}
            <section>
              <SectionTitle className="mb-2">روند دقت دانش‌آموز</SectionTitle>
              {detail.trend.some((p) => p.accuracy !== null) ? (
                <TrendBars data={detail.trend} heightClass="h-24" />
              ) : (
                <EmptyState title="دادهٔ روندی برای این دانش‌آموز نیست" />
              )}
            </section>

            {/* فاکتورهای گلوگاه */}
            <section>
              <SectionTitle className="mb-2">فاکتورهای گلوگاه</SectionTitle>
              {detail.bottlenecks.length === 0 ? (
                <EmptyState title="گلوگاه فعالی برای این دانش‌آموز یافت نشد" />
              ) : (
                <ul className="space-y-3">
                  {detail.bottlenecks.map((fact) => (
                    <FactRow key={fact.fact} fact={fact} />
                  ))}
                </ul>
              )}
            </section>

            {/* پیشنهادهای آموزشی */}
            <section>
              <SectionTitle className="mb-2">پیشنهادهای آموزشی</SectionTitle>
              <div className="mb-3">
                <RemedyCard detail={detail} />
              </div>
              {detail.recommendations.length === 0 ? (
                <EmptyState title="پیشنهادی ثبت نشده است" />
              ) : (
                <ul className="space-y-2">
                  {detail.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* مأموریت‌های معلم — فقط وقتی مأموریتی وجود دارد */}
            <TeacherAssignmentsSection studentId={detail.student.id} />

            {/* جلسه‌های اخیر */}
            <section>
              <SectionTitle className="mb-2">جلسه‌های اخیر</SectionTitle>
              {detail.recentSessions.length === 0 ? (
                <EmptyState title="جلسه‌ای ثبت نشده است" />
              ) : (
                <ul className="space-y-1.5">
                  {detail.recentSessions.slice(0, 6).map((session) => (
                    <li
                      key={session.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{session.layerName}</p>
                        <p className="text-[11px] text-slate-500">
                          {faNum(session.correct)} از {faNum(session.total)} درست · {faRelative(session.createdAt)}
                        </p>
                      </div>
                      <AccuracyBadge accuracy={session.accuracy} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
