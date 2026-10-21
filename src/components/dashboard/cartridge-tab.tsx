"use client";

// تب «بانک تمرین خشاب» — نمایش خشاب منتشرشدهٔ KH-G3-MATH + برچسب‌سنجی زندهٔ
// هر گزینهٔ انحرافی با موتور واقعی بازی (classifyAttempt + classifyV103).
// داده‌ها از /api/cartridge می‌آید که موتور را از public/math-game دوباره
// import می‌کند (تک‌منبع حقیقت) — اینجا هیچ قاعدهٔ تشخیصی تکرار نمی‌شود.

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileSpreadsheet,
  PackageOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard, EmptyState } from "@/components/dashboard/state-views";
import { faDateTime, faNum } from "@/lib/dashboard/constants";
import type { CartridgeIdentityField, CartridgeQuestion, CartridgeResponse, CartridgeVerdict } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

const OPTION_LETTERS = ["الف", "ب", "ج", "د"] as const;

function identityValue(identity: CartridgeIdentityField[], field: string): string | null {
  const f = identity.find((x) => x?.field === field);
  return f?.value ?? null;
}

/** Badge وضعیت سؤال/درس — سبز = تأییدشده، amber = نیاز به تأیید */
function statusBadgeClass(status: string): string {
  return status === "تأییدشده"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-amber-100 text-amber-800 border-amber-200";
}

/** چیپ حکم موتور برای یک گزینهٔ انحرافی — کد engine یا «بی‌الگو»ی صادقانه */
function VerdictTag({ verdict }: { verdict: CartridgeVerdict }) {
  if (verdict.engineCode) {
    return (
      <span
        dir="ltr"
        title={verdict.claim ?? undefined}
        className="inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800"
      >
        {verdict.engineCode}
      </span>
    );
  }
  return (
    <span
      className="text-[10px] leading-4 text-slate-400"
      title={verdict.value === null ? "گزینهٔ عددی نیست — به موتور نرسید" : "موتور الگوی شناخته‌شده‌ای در این پاسخ ندید"}
    >
      {verdict.value === null ? "غیرعددی" : "بی‌الگو"}
    </span>
  );
}

/** یک ردیف سؤال بانک: متادیتا + متن سؤال + چهار گزینه با حکم زندهٔ موتور */
function QuestionRow({ q }: { q: CartridgeQuestion }) {
  const verdictByLetter = new Map(q.verdicts.map((v) => [v.letter, v]));
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("px-2 py-0 text-[10px]", statusBadgeClass(q.status))}>
          {q.status}
        </Badge>
        <span dir="ltr" className="font-mono text-xs font-bold text-slate-700">
          {q.id}
        </span>
        {q.anchorTitle ? (
          <span className="text-[11px] text-slate-500">لنگر: {q.anchorTitle}</span>
        ) : null}
        {q.cpa ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
            {q.cpa}
          </span>
        ) : null}
        {q.domain ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
            {q.domain}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm font-medium leading-7 text-slate-800">{q.prompt}</p>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {q.options.map((option, i) => {
          const letter = OPTION_LETTERS[i] ?? String(i);
          if (i === q.answerIndex) {
            return (
              <span
                key={i}
                className="flex flex-col gap-0.5 rounded-lg border border-emerald-300 bg-emerald-50/70 p-2 ring-1 ring-emerald-100"
              >
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                  <Check className="size-3" aria-hidden />
                  {letter} — پاسخ درست
                </span>
                <span className="text-xs font-medium leading-5 text-emerald-900">{option}</span>
              </span>
            );
          }
          const verdict = verdictByLetter.get(letter);
          return (
            <span
              key={i}
              className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-2"
              title={verdict?.claim ?? undefined}
            >
              <span className="text-[10px] text-slate-400">{letter}</span>
              <span className="text-xs leading-5 text-slate-700">{option}</span>
              {verdict ? <VerdictTag verdict={verdict} /> : null}
            </span>
          );
        })}
      </div>
    </li>
  );
}

interface CartridgeTabProps {
  data?: CartridgeResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function CartridgeTab({ data, isLoading, isError, onRetry }: CartridgeTabProps) {
  const [warningsOpen, setWarningsOpen] = useState(false);

  if (isError) {
    return <ErrorCard onRetry={onRetry} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cartridge, bank } = data;
  const validation = cartridge.validation;
  const stats = validation?.stats;
  const gate = validation?.gate;
  const warnings = validation?.warnings ?? [];
  const title = identityValue(cartridge.identity, "عنوان فارسی خشاب");

  return (
    <div className="space-y-4">
      {/* نوار توضیح */}
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <PackageOpen className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
        <p className="text-xs leading-6 text-emerald-900 sm:text-sm">
          بانک سؤال خشاب منتشرشده با حکم زندهٔ موتور تشخیص برای هر گزینهٔ انحرافی — برچسب‌ها
          هم‌زمان با موتور بازی به‌روز می‌شوند (تک‌منبع حقیقت)، نه نسخهٔ کپی‌شده.
        </p>
      </div>

      {/* کارت شناسنامهٔ خشاب */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            شناسنامهٔ خشاب
            {cartridge.cartridgeId ? (
              <span dir="ltr" className="font-mono text-sm font-bold text-emerald-700">
                {cartridge.cartridgeId}
              </span>
            ) : null}
            {title ? <span className="text-sm font-normal text-slate-500">— {title}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats && gate ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                سؤال {faNum(stats.questions)} = {faNum(stats.questionsConfirmed)} تأیید +{" "}
                {faNum(stats.questionsProposed)} پیشنهاد
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                اطلس {faNum(stats.atlasReal)}+{faNum(stats.atlasProposed)}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                درس {faNum(stats.lessons)} = {faNum(stats.lessonsConfirmed)} تأیید
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold",
                  gate.red > 0
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                گیت: {gate.verdict} — {faNum(gate.red)} قرمز / {faNum(gate.yellow)} زرد
              </Badge>
            </div>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {cartridge.source?.file ? (
              <span className="inline-flex items-center gap-1">
                <FileSpreadsheet className="size-3.5" aria-hidden />
                منبع: {cartridge.source.file}
              </span>
            ) : null}
            {cartridge.source?.tool ? <span dir="ltr">{cartridge.source.tool}</span> : null}
            <span>زمان تولید: {faDateTime(cartridge.generatedAt)}</span>
          </p>

          {warnings.length > 0 ? (
            <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  <AlertTriangle className="size-3.5" aria-hidden />
                  هشدارهای زرد گیت ({faNum(warnings.length)})
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", warningsOpen && "rotate-180")}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="custom-scroll mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[11px] leading-5 text-amber-900">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </CardContent>
      </Card>

      {/* بانک سؤال — ۲۰ ردیف با حکم زندهٔ گزینه‌ها */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            بانک سؤال{" "}
            <span className="text-sm font-normal text-slate-400">
              ({faNum(bank.length)} سؤال — حکم موتور روی گزینه‌های انحرافی)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bank.length === 0 ? (
            <EmptyState
              title="بانک سؤال خالی است"
              description="خشاب منتشرشده هیچ سؤالی ندارد — با مبدل خشاب بازتولید کنید."
            />
          ) : (
            <ul className="custom-scroll max-h-96 space-y-3 overflow-y-auto pe-1">
              {bank.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
