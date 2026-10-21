"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Package,
  RefreshCw,
  ScanLine,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { StudentsTab } from "@/components/dashboard/students-tab";
import { StudentDetailSheet } from "@/components/dashboard/student-detail-sheet";
import { BottlenecksTab } from "@/components/dashboard/bottlenecks-tab";
import { CartridgeTab } from "@/components/dashboard/cartridge-tab";
import { LeaderboardTab } from "@/components/dashboard/leaderboard-tab";
import { AiReportDialog } from "@/components/dashboard/ai-report-dialog";
import { ScanPaperDialog } from "@/components/dashboard/scan-paper-dialog";
import { fetchBottlenecks, fetchCartridge, fetchLeaderboard, fetchOverview, fetchStudents } from "@/components/dashboard/api";
import { faRelative } from "@/lib/dashboard/constants";
import { useToast } from "@/hooks/use-toast";

type TabKey = "overview" | "students" | "leaderboard" | "bottlenecks" | "cartridge";

/** تاریخ شمسی امروز — فقط در کلاینت محاسبه می‌شود تا با SSR ناسازگار نشود */
function useTodayFa(): string {
  const subscribe = useCallback(() => () => {}, []);
  const getSnapshot = useCallback(() => {
    try {
      const now = new Date();
      const part = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat("fa-IR", options).format(now);
      return `${part({ weekday: "long" })} ${part({ day: "numeric" })} ${part({ month: "long" })} ${part({ year: "numeric" })}`;
    } catch {
      return "";
    }
  }, []);
  const getServerSnapshot = useCallback(() => "", []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function TeacherDashboardPage() {
  const { toast } = useToast();

  const overviewQuery = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
    refetchInterval: 30_000,
  });
  const studentsQuery = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    refetchInterval: 30_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    refetchInterval: 30_000,
  });
  const bottlenecksQuery = useQuery({
    queryKey: ["bottlenecks"],
    queryFn: fetchBottlenecks,
    refetchInterval: 30_000,
  });
  // خشاب محتوای منتشرشده استاتیک است — بدون بازآوری دوره‌ای
  const cartridgeQuery = useQuery({
    queryKey: ["cartridge"],
    queryFn: fetchCartridge,
  });

  const [tab, setTab] = useState<TabKey>("overview");
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const today = useTodayFa();

  const refetchAll = useCallback(async () => {
    await Promise.all([
      overviewQuery.refetch(),
      studentsQuery.refetch(),
      leaderboardQuery.refetch(),
      bottlenecksQuery.refetch(),
      cartridgeQuery.refetch(),
    ]);
  }, [overviewQuery, studentsQuery, leaderboardQuery, bottlenecksQuery, cartridgeQuery]);

  const isRefreshing =
    overviewQuery.isRefetching ||
    studentsQuery.isRefetching ||
    leaderboardQuery.isRefetching ||
    bottlenecksQuery.isRefetching ||
    cartridgeQuery.isRefetching;

  // پیام خطای یک‌باره هنگام شکست واکشی
  const anyError =
    overviewQuery.isError ||
    studentsQuery.isError ||
    bottlenecksQuery.isError ||
    cartridgeQuery.isError;
  const errorToastShown = useRef(false);
  useEffect(() => {
    if (anyError && !errorToastShown.current) {
      errorToastShown.current = true;
      toast({
        title: "خطا در دریافت داده‌ها",
        description: "ارتباط با سرور برقرار نشد؛ می‌توانید دوباره تلاش کنید.",
        variant: "destructive",
      });
    }
    if (!anyError) {
      errorToastShown.current = false;
    }
  }, [anyError, toast]);

  const openStudent = useCallback((id: string) => {
    setActiveStudentId(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* هدر چسبان */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">داشبورد معلم</h1>
              <p className="truncate text-xs text-slate-500">کارگاه ضرب — ایستگاه یادگیری مضاعف</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchAll()}
              disabled={isRefreshing}
              aria-label="بازآوری داده‌ها"
            >
              <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden />
              <span className="hidden sm:inline">بازآوری</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScanOpen(true)}
              aria-label="اسکن برگهٔ کاغذی"
            >
              <ScanLine className="size-4" aria-hidden />
              <span className="hidden sm:inline">اسکن برگه</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setAiOpen(true)}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              aria-label="گزارش هوشمند AI"
            >
              <Sparkles className="size-4" aria-hidden />
              <span className="hidden sm:inline">گزارش هوشمند AI</span>
            </Button>
            <Button variant="outline" size="sm" asChild aria-label="اجرای بازی">
              <a href="/math-game/v10.html" target="_blank" rel="noopener noreferrer">
                <Gamepad2 className="size-4" aria-hidden />
                <span className="hidden md:inline">اجرای بازی</span>
              </a>
            </Button>
          </div>
        </div>
        {/* نوار تاریخ */}
        <div className="border-t border-slate-100 bg-white/60">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-1.5 text-[11px] text-slate-500 sm:px-6">
            <span>امروز: {today || "—"}</span>
            <span>
              آخرین به‌روزرسانی:{" "}
              <span className="tabular-nums">{faRelative(overviewQuery.data?.generatedAt)}</span>
            </span>
          </div>
        </div>
      </header>

      {/* محتوا */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="space-y-6">
          <KpiCards kpis={overviewQuery.data?.kpis} />

          <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
              <TabsTrigger value="overview" className="gap-1.5">
                <LayoutDashboard className="size-4" aria-hidden />
                نمای کلی
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-1.5">
                <Users className="size-4" aria-hidden />
                دانش‌آموزان
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-1.5">
                <Trophy className="size-4" aria-hidden />
                جدول قهرمانان
              </TabsTrigger>
              <TabsTrigger value="bottlenecks" className="gap-1.5">
                <AlertTriangle className="size-4" aria-hidden />
                گلوگاه‌های یادگیری
              </TabsTrigger>
              <TabsTrigger value="cartridge" className="gap-1.5">
                <Package className="size-4" aria-hidden />
                بانک تمرین خشاب
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <OverviewTab
                data={overviewQuery.data}
                isLoading={overviewQuery.isLoading}
                isError={overviewQuery.isError}
                onRetry={() => void overviewQuery.refetch()}
              />
            </TabsContent>

            <TabsContent value="students" className="mt-4">
              <StudentsTab
                data={studentsQuery.data}
                isLoading={studentsQuery.isLoading}
                isError={studentsQuery.isError}
                onRetry={() => void studentsQuery.refetch()}
                onSelectStudent={openStudent}
              />
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-4">
              <LeaderboardTab
                data={leaderboardQuery.data}
                isLoading={leaderboardQuery.isLoading}
                isError={leaderboardQuery.isError}
                onRetry={() => void leaderboardQuery.refetch()}
              />
            </TabsContent>

            <TabsContent value="bottlenecks" className="mt-4">
              <BottlenecksTab
                data={bottlenecksQuery.data}
                isLoading={bottlenecksQuery.isLoading}
                isError={bottlenecksQuery.isError}
                onRetry={() => void bottlenecksQuery.refetch()}
                onSelectStudent={openStudent}
                onOpenAiReport={() => setAiOpen(true)}
              />
            </TabsContent>

            <TabsContent value="cartridge" className="mt-4">
              <CartridgeTab
                data={cartridgeQuery.data}
                isLoading={cartridgeQuery.isLoading}
                isError={cartridgeQuery.isError}
                onRetry={() => void cartridgeQuery.refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* فوتر چسبان */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>کارگاه ضرب — داشبورد معلم · داده‌ها زنده از دیتابیس SQLite</p>
          <p className="flex items-center gap-2">
            <span>مدل ۹ لایهٔ عمق v10.1</span>
            <span aria-hidden>·</span>
            <a
              href="/math-game/v10.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 hover:underline"
            >
              بازی کارگاه ضرب
            </a>
            <span aria-hidden>·</span>
            <a
              href="/math-game/pilot/pilot-prints-fase0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 hover:underline"
            >
              بستهٔ چاپی پایلوت 🖨️
            </a>
            <span aria-hidden>·</span>
            <a
              href="/math-game/release/math-game-v10.3.0-beta.0-full.zip"
              download
              className="font-medium text-emerald-700 hover:underline"
            >
              دانلود ریلیز v10.3.0-beta.0 📦
            </a>
            <span aria-hidden>·</span>
            <a
              href="/math-game/authoring/MOTOR-TALIF-KHSHAB-v1.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 hover:underline"
            >
              موتور تألیف خشاب 🧠
            </a>
          </p>
        </div>
      </footer>

      {/* لایه‌های سراسری */}
      <StudentDetailSheet
        studentId={activeStudentId}
        onOpenChange={(open) => {
          if (!open) setActiveStudentId(null);
        }}
      />
      <AiReportDialog open={aiOpen} onOpenChange={setAiOpen} />
      <ScanPaperDialog open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  );
}
