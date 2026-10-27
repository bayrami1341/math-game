// تب «ریل اصلی» — تابلوی نظارت هماهنگ‌کننده بر خط لولهٔ سه‌بخشی
// طبق فرمان مالک: طراحی و نظارت کل ریل با z.ai است؛ این تابلو فقط وضعیت را می‌خواند
// و هیچ داوری ارزشی یا مُهری ندارد. تصمیم‌های انسانی همیشه جدا و صریح نمایش داده می‌شوند.

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  Bot,
  BookOpen,
  CircleDashed,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  Gamepad2,
  GitCommitHorizontal,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchRail } from "@/components/dashboard/api";
import type {
  RailBoundary,
  RailBudget,
  RailHandoffView,
  RailPart,
  RailStatus,
  RailView,
} from "@/lib/dashboard/rail-status";

// ---------- قالب‌بندی فارسی ----------
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (value: number | string): string =>
  String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

function statusBadge(status: RailStatus): { label: string; className: string } {
  switch (status) {
    case "green":
      return { label: "سبز — سالم", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "amber":
      return { label: "کهربایی — منتظر تصمیم انسانی", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "red":
      return { label: "قرمز — مسدود", className: "bg-red-100 text-red-800 border-red-200" };
  }
}

function StatusDot({ status }: { status: RailStatus }) {
  const cls =
    status === "green"
      ? "bg-emerald-500"
      : status === "amber"
        ? "bg-amber-500"
        : "bg-red-500";
  return <span className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

// ---------- بصری‌سازی خط لوله ----------

function PipelineNodes({ view }: { view: RailView }) {
  const nodes = [
    { icon: BookOpen, label: "کتاب درسی رسمی", sub: "منبع خام" },
    { icon: Bot, label: "بخش ۱ — آشیل", sub: "استخراج صفحه‌به‌صفحه" },
    { icon: ClipboardCheck, label: "بخش ۲ — ممیزی", sub: "ارزش‌گذاری و مُهر انسان" },
    { icon: Cpu, label: "بخش ۳ — موتور", sub: "تبدیل به سؤال و تمرین" },
    { icon: Gamepad2, label: "بازی و تمرین", sub: "«سفر تا صد» + ابزار معلم" },
  ];

  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      {nodes.map((node, index) => (
        <div key={node.label} className="flex flex-1 flex-col items-stretch gap-2 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
              <node.icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{node.label}</p>
              <p className="truncate text-xs text-slate-500">{node.sub}</p>
            </div>
          </div>
          {index < nodes.length - 1 && (
            <>
              <ArrowLeft className="hidden size-5 shrink-0 text-slate-400 md:block" aria-hidden />
              <div className="flex justify-center md:hidden">
                <ArrowDown className="size-5 text-slate-400" aria-hidden />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- کارت بخش ----------

function PartCard({ part }: { part: RailPart }) {
  const badge = statusBadge(part.status);
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-6">{part.title}</CardTitle>
          <Badge variant="outline" className={`shrink-0 ${badge.className}`}>
            {part.status === "green" ? "سبز" : part.status === "amber" ? "کهربایی" : "قرمز"}
          </Badge>
        </div>
        <CardDescription>{part.scope}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-1.5 pt-0 text-xs text-slate-600">
        <p>
          <span className="font-semibold text-slate-700">توسعه‌دهنده: </span>
          {part.developer}
        </p>
        <p>
          <span className="font-semibold text-slate-700">هماهنگی: </span>
          {part.coordinator}
        </p>
        <Separator className="my-2" />
        <p className="leading-5">{part.statusText}</p>
      </CardContent>
    </Card>
  );
}

// ---------- کارت تحویل اسکلت ساخت به دو بخش قبلی ----------

function HandoffCard({ handoff }: { handoff: RailHandoffView }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm leading-6">
              <FileCheck2 className="size-4 shrink-0 text-emerald-700" aria-hidden />
              تحویل اسکلت ساخت G2/G3 به دو بخش قبلی — «اسکلت قبل از هر تحلیل»
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-[10px]">
              فرمان مالک: {handoff.orderTrace} — اجرا: {handoff.deliveryTrace} — تحویل {handoff.issuedAtTehran}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-100 text-emerald-800">
            {handoff.status === "DELIVERED" ? "ارسال‌شده" : handoff.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            بودجهٔ خشاب G2: {faNum(368)}–{faNum(552)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            بودجهٔ خشاب G3: {faNum(456)}–{faNum(684)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {faNum(handoff.filesCount)} فایل با SHA-256
          </Badge>
        </div>
        <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
          کامیت تحویل در مخزن بازی: <span className="font-mono">{handoff.deliveryCommit}</span>
          {handoff.evidenceCommits.length > 0 && (
            <>
              {" "}
              — کامیت‌های شاهد بودجه‌ها: {""}
              <span className="font-mono">{handoff.evidenceCommits.join(" / ")}</span>
            </>
          )}
          {" "}
          — گیت بسته: <span className="font-mono">{handoff.gate.script}</span> ({faNum(handoff.gate.tests)} آزمون):{" "}
          <span className="font-bold">{handoff.gate.result}</span>
        </p>
        <div className="space-y-2">
          {handoff.recipients.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-800">{r.fa}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">بریف کپی‌آماده: {r.brief}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-700">نخستین کار: </span>
                {r.firstTask}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- کارت بودجهٔ رسمی مالک ----------

function BudgetCard({
  budget,
  title,
  checksNote,
}: {
  budget: RailBudget;
  title: string;
  checksNote: string;
}) {
  const levelKeys = Object.keys(budget.levels ?? {});
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm leading-6">
              <ListChecks className="size-4 shrink-0 text-emerald-700" aria-hidden />
              بودجهٔ رسمی سؤالات {title} — مالک (OWNER_AUTHORITATIVE)
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-[10px]">
              {budget.path} — trace {budget.traceId}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-100 text-emerald-800">
            پاکت کنترل مرز B2
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            جمع کل: {faNum(budget.totalMin)} تا {faNum(budget.totalMax)} سؤال
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {faNum(budget.chapters)} فصل
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {faNum(budget.subtopics)} موضوع اصلی
          </Badge>
          {budget.ratiosClaimed &&
            Object.entries(budget.ratiosClaimed).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-xs">
                {k}: {faNum(Math.round(v * 100))}٪
              </Badge>
            ))}
        </div>
        {levelKeys.length > 0 && (
          <p className="text-xs leading-5 text-slate-600">
            باند کل سه سطح: {""}
            {levelKeys.map((k) => (
              <span key={k} className="ml-2 font-semibold text-slate-800">
                {k} {faNum(budget.levels?.[k]?.[0] ?? 0)}–{faNum(budget.levels?.[k]?.[1] ?? 0)}
              </span>
            ))}
          </p>
        )}
        <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
          گیت ماشینی راستی‌آزمایی: <span className="font-mono">{budget.verification?.script ?? "—"}</span> — نتیجه: {""}
          <span className="font-bold">{budget.verification?.result ?? "—"}</span> ({faNum(budget.verification?.checks?.length ?? 0)} آزمون: {checksNote})
        </p>
        {budget.reconciliation && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-900">
              شکاف با ماتریس فعلی: {faNum(budget.reconciliation.matrixCurrent?.g3MinTotal ?? 0)}{" "}
              کمتر از حداقل بودجه ({faNum(budget.totalMin)})
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800">{budget.reconciliation.gap}</p>
          </div>
        )}
        {budget.foldingRule && (
          <p className="text-xs leading-5 text-slate-600">قاعدهٔ موضوعات فرعی: {budget.foldingRule}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- کارت مرز ----------

function BoundaryCard({ boundary }: { boundary: RailBoundary }) {
  const badge = statusBadge(boundary.status);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm leading-6">
              <FileCheck2 className="size-4 shrink-0 text-emerald-700" aria-hidden />
              {boundary.id} — {boundary.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {boundary.from} ← {boundary.to}
            </CardDescription>
          </div>
          <Badge variant="outline" className={`shrink-0 ${badge.className}`}>
            {boundary.status === "green" ? "سبز" : boundary.status === "amber" ? "کهربایی" : "قرمز"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {boundary.summary}
        </p>
        <ul className="space-y-2.5">
          {boundary.mechanisms.map((m) => (
            <li key={m.name} className="flex gap-2 text-xs leading-5">
              <StatusDot status={m.status} />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{m.name}</p>
                {m.evidence && (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
                    {m.evidence}
                  </p>
                )}
                {m.detail && <p className="mt-0.5 text-slate-600">{m.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- تب اصلی ----------

export function RailTab() {
  const railQuery = useQuery({
    queryKey: ["rail"],
    queryFn: fetchRail,
    refetchInterval: 60_000,
  });

  if (railQuery.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          در حال خواندن وضعیت ریل…
        </div>
      </div>
    );
  }

  if (railQuery.isError || !railQuery.data) {
    return (
      <Alert variant="destructive">
        <CircleDashed className="size-4" aria-hidden />
        <AlertTitle>خطا در خواندن وضعیت ریل</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>ارتباط با سرور برقرار نشد. می‌توانید دوباره تلاش کنید.</span>
          <Button variant="outline" size="sm" onClick={() => void railQuery.refetch()}>
            <RefreshCw className="size-4" aria-hidden />
            تلاش مجدد
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const view: RailView = railQuery.data;
  const teacherDecisions = view.decisions.filter((d) => d.group === "معلم");
  const ownerDecisions = view.decisions.filter((d) => d.group === "مالک کار");

  return (
    <div className="space-y-6">
      {/* یادداشت هماهنگ‌کننده */}
      <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
        <Workflow className="size-4" aria-hidden />
        <AlertTitle>تابلوی نظارت ریل اصلی — هماهنگ‌کننده: z.ai</AlertTitle>
        <AlertDescription className="leading-6">
          {view.coordinatorNote}
          {view.railContract?.exists && (
            <span className="mt-1 block text-xs text-emerald-800">
              قرارداد رسمی ریل: <span className="font-mono">{view.railContract.path}</span> — {view.railContract.note}
            </span>
          )}
          <span className="mt-1 block text-xs text-emerald-800">
            وضعیت در لحظه: {view.generatedAtTehran} — این تابلو فقط می‌خواند؛ مُهر و رأی فقط کار انسان است.
          </span>
        </AlertDescription>
      </Alert>

      {/* نقشهٔ خط لوله */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">نقشهٔ خط لوله — از کتاب تا بازی</CardTitle>
          <CardDescription>
            محتوا از کتاب وارد می‌شود، از سه بخش می‌گذرد و به بازی و تمرین گیمیفای‌شده می‌رسد؛ حلقهٔ بازخورد از داشبورد به بخش ۲ برمی‌گردد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PipelineNodes view={view} />
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">
              حلقهٔ بازخورد (کهربایی): {view.feedbackLoop.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800">{view.feedbackLoop.summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* تحویل اسکلت ساخت به دو بخش قبلی (فرمان مالک) */}
      {view.handoff?.exists && <HandoffCard handoff={view.handoff} />}

      {/* بودجهٔ رسمی مالک — پایهٔ سوم و دوم */}
      {view.budget?.exists && (
        <BudgetCard
          budget={view.budget}
          title="پایهٔ سوم"
          checksNote="سازگاری ۳۶ ردیف، جمع فرعی=اصلی در ۸ فصل، جمع‌های کل، نسبت ۳۳/۴۶/۲۱"
        />
      )}
      {view.budgetG2?.exists && (
        <BudgetCard
          budget={view.budgetG2}
          title="پایهٔ دوم"
          checksNote="سازگاری ۳۲ ردیف، جمع فرعی=اصلی در ۸ فصل، نسبت ۳۲٫۶/۴۶٫۲/۲۱٫۲ ثابت در دو سر، تطبیق کالیبراسیون چاپی"
        />
      )}

      {/* نقش‌ها و مالکیت */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-800">سه بخش ریل و مالکیت توسعه</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {view.parts.map((part) => (
            <PartCard key={part.id} part={part} />
          ))}
        </div>
      </div>

      {/* مرزها */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-800">
          مرزهای ریل و سازوکارهای گیت‌دار ({faNum(view.pipeline.length)} مرز)
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {view.pipeline.map((boundary) => (
            <BoundaryCard key={boundary.id} boundary={boundary} />
          ))}
        </div>
      </div>

      {/* تصمیم‌های انسانی معلق */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            تصمیم‌های انسانی معلق ({faNum(view.decisions.length)} مورد) — رأی فقط با انسان
          </CardTitle>
          <CardDescription>
            هیچ‌یک از این موارد را AI تصمیم نمی‌گیرد؛ هر مورد تا رأی شما باز می‌ماند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-700">
              گروه ۱ — رأی معلم ({faNum(teacherDecisions.length)} مورد)
            </p>
            <ul className="space-y-2">
              {teacherDecisions.map((d) => (
                <li key={d.id} className="flex gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                    {d.id}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{d.title}</p>
                    {d.note && <p className="mt-0.5 text-slate-600">{d.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-700">
              گروه ۲ و ۳ — رأی صاحب کار ({faNum(ownerDecisions.length)} مورد)
            </p>
            <ul className="space-y-2">
              {ownerDecisions.map((d) => (
                <li key={d.id} className="flex gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-white">
                    {d.id}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{d.title}</p>
                    {d.note && <p className="mt-0.5 text-slate-600">{d.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* اصول حاکمیتی هماهنگی */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-emerald-700" aria-hidden />
            اصول حاکمیتی هماهنگی ریل (در نقش تازه نیز تغییرناپذیر)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ol className="space-y-2">
            {view.principles.map((p, index) => (
              <li key={p} className="flex gap-2.5 text-xs leading-5 text-slate-700">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                  {faNum(index + 1)}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* وضعیت رجیستری */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            وضعیت رجیستری نقشه‌ها (v{faNum(view.registry.version)} — {faNum(view.registry.total)} نقشه)
          </CardTitle>
          <CardDescription>
            منبع واحد حقیقت ماشین‌پذیر: blueprints/registry.json روی main مخزن رسمی
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {view.registry.error && (
            <p className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{view.registry.error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {view.registry.counts.map((c) => (
              <Badge key={c.label} variant="secondary" className="text-xs">
                {c.label}: {faNum(c.value)}
              </Badge>
            ))}
          </div>
          {view.registry.lastCommit && (
            <p className="flex items-start gap-2 break-all text-xs text-slate-600">
              <GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
              <span>
                <span className="font-mono font-semibold text-slate-800">
                  {view.registry.lastCommit.sha}
                </span>{" "}
                — {view.registry.lastCommit.subject}
              </span>
            </p>
          )}
          {view.registry.pendingAcceptance.length > 0 && (
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-900">در انتظار پذیرش مالک:</p>
              {view.registry.pendingAcceptance.map((bp) => (
                <p key={bp.id} className="text-xs leading-5 text-amber-900">
                  <span className="font-mono font-semibold">{bp.id}</span> — {bp.title}
                </p>
              ))}
            </div>
          )}
          <Separator />
          <p className="text-xs text-slate-600">
            موتور بخش ۳: {faNum(view.engineTests.passed)}/{faNum(view.engineTests.total)} تست سبز —{" "}
            {view.engineTests.note}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
