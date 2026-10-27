"use client";

// تب «کارگاه خشاب» — نصب آسان خشاب + بازبینی کامل هر سه بخش محتوایی
//
//  • فهرست خشاب‌های نصب‌شده (KH-*.json از پوشهٔ cartridges) با حکم گیت هرکدام
//  • نصب از فایل JSON خروجی مبدل — fail-closed: خشاب قرمز هرگز نصب نمی‌شود
//  • زیرنماهای شناسنامه / نقشهٔ کتاب / اطلس خطا / بانک سؤال برای هر خشاب
//  • بانک سؤال با برچسب‌سنجی زندهٔ موتور واقعی بازی (classifyAttempt + classifyV103)
//    از /api/cartridges که موتور را از public/math-game import می‌کند (تک‌منبع حقیقت)

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Check,
  ChevronDown,
  FileSpreadsheet,
  ListChecks,
  Package,
  PackageOpen,
  Upload,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorCard, EmptyState } from "@/components/dashboard/state-views";
import {
  fetchCartridgeDetail,
  fetchCartridges,
  installCartridge,
} from "@/components/dashboard/api";
import { faDateTime, faNum } from "@/lib/dashboard/constants";
import type {
  CartridgeAtlasRow,
  CartridgeBookMapRow,
  CartridgeDetailResponse,
  CartridgeListItem,
  CartridgeQuestion,
  CartridgeVerdict,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const OPTION_LETTERS = ["الف", "ب", "ج", "د"] as const;

type SubTab = "identity" | "bookmap" | "atlas" | "bank";

function identityValue(
  identity: { field: string; value: string }[],
  field: string
): string | null {
  const f = identity.find((x) => x?.field === field);
  return f?.value ?? null;
}

/** Badge وضعیت ردیف — سبز = تأییدشده، amber = نیاز به تأیید */
function statusBadgeClass(status: string | null): string {
  return status === "تأییدشده"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-amber-100 text-amber-800 border-amber-200";
}

/** رنگ نقطهٔ گیت — قرمز غالب، زرد هشدار، سبز پاک */
function gateDotClass(item: CartridgeListItem): string {
  if (!item.gate) return "bg-slate-300";
  if (item.gate.red > 0) return "bg-rose-500";
  if (item.gate.yellow > 0) return "bg-amber-400";
  return "bg-emerald-500";
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

/** چیپ انتخاب خشاب — شناسه + عنوان + نقطهٔ گیت + آمار فشرده */
function CartridgeChip({
  item,
  selected,
  onSelect,
}: {
  item: CartridgeListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl border p-3 text-start transition-colors sm:flex-none sm:min-w-44",
        selected
          ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200"
          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <span className={cn("size-2 shrink-0 rounded-full", gateDotClass(item))} aria-hidden />
        <span dir="ltr" className="truncate font-mono text-xs font-bold text-slate-700">
          {item.id}
        </span>
      </span>
      <span className="w-full truncate text-[11px] text-slate-500" title={item.title ?? undefined}>
        {item.title ?? "بدون عنوان"}
      </span>
      <span className="text-[10px] text-slate-400">
        {item.stats
          ? `درس ${faNum(item.stats.lessons)} · سؤال ${faNum(item.stats.questions)}`
          : "بدون آمار"}
      </span>
    </button>
  );
}

/** ردیف نقشهٔ کتاب (S1) */
function BookMapTable({ rows }: { rows: CartridgeBookMapRow[] }) {
  return (
    <div className="custom-scroll max-h-96 overflow-y-auto rounded-xl border border-slate-200">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
          <TableRow>
            <TableHead className="text-right">شناسه</TableHead>
            <TableHead className="text-right">صفحه</TableHead>
            <TableHead className="text-right">فصل</TableHead>
            <TableHead className="text-right">عنوان</TableHead>
            <TableHead className="text-right">اهداف رفتاری</TableHead>
            <TableHead className="text-right">سازگاری موتور</TableHead>
            <TableHead className="text-right">وضعیت</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`${row.id ?? "بدون-شناسه"}-${i}`}>
              <TableCell dir="ltr" className="whitespace-nowrap text-start font-mono text-xs font-bold text-slate-700">
                {row.id ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs tabular-nums text-slate-600">
                {row.page ?? "—"}
              </TableCell>
              <TableCell className="text-xs tabular-nums text-slate-600">{row.chapter ?? "—"}</TableCell>
              <TableCell className="max-w-40 truncate text-xs font-medium text-slate-800" title={row.title ?? undefined}>
                {row.title ?? "—"}
              </TableCell>
              <TableCell className="max-w-64 truncate text-xs text-slate-600" title={row.objective ?? undefined}>
                {row.objective ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-slate-600">{row.engineCompat ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("px-2 py-0 text-[10px]", statusBadgeClass(row.status))}>
                  {row.status ?? "—"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** یک ردیف اطلس خطا */
function AtlasRow({ row }: { row: CartridgeAtlasRow }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn("px-2 py-0 text-[10px]", statusBadgeClass(row.status))}>
          {row.status ?? "—"}
        </Badge>
        <span dir="ltr" className="font-mono text-xs font-bold text-slate-700">
          {row.code ?? "—"}
        </span>
        <span className="text-xs font-semibold text-slate-800">{row.nameFa ?? ""}</span>
        {row.category ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
            {row.category}
          </span>
        ) : null}
        {row.priority ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
            اولویت: {row.priority}
          </span>
        ) : null}
      </div>
      {row.description ? (
        <p className="mt-2 text-xs leading-6 text-slate-700">{row.description}</p>
      ) : null}
      {row.behavioralSignal ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          <span className="font-medium text-slate-600">نشانهٔ رفتاری: </span>
          {row.behavioralSignal}
        </p>
      ) : null}
    </li>
  );
}

export function CartridgeTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>("KH-G3-MATH");
  const [subTab, setSubTab] = useState<SubTab>("identity");
  const [installing, setInstalling] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["cartridges-list"],
    queryFn: fetchCartridges,
  });
  const list = listQuery.data?.cartridges ?? [];

  // اگر خشاب انتخابی در فهرست نبود → KH-G3 یا اولین فهرست
  useEffect(() => {
    if (listQuery.isError || listQuery.isLoading) return;
    if (list.length === 0) return;
    if (!selectedId || !list.some((c) => c.id === selectedId)) {
      setSelectedId(list.find((c) => c.id === "KH-G3-MATH")?.id ?? list[0].id);
    }
  }, [listQuery.isLoading, listQuery.isError, list, selectedId]);

  const detailQuery = useQuery({
    queryKey: ["cartridge-detail", selectedId],
    queryFn: () => fetchCartridgeDetail(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const onPickFile = async (file: File) => {
    if (installing) return;
    try {
      setInstalling(true);
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        toast({
          title: "فایل JSON معتبر نیست",
          description: "فایل باید JSON خروجی مبدل خشاب باشد.",
          variant: "destructive",
        });
        return;
      }
      const result = await installCartridge(data, true);
      if (result.ok) {
        const gate = result.validation?.gate;
        toast({
          title: `خشاب ${result.id} نصب شد${result.overwritten ? " (بازنویسی نسخهٔ قبلی)" : ""}`,
          description: gate
            ? `گیت: ${gate.verdict} — ${faNum(gate.red)} قرمز / ${faNum(gate.yellow)} زرد`
            : "اعتبارسنجی موتور بازی پاس شد.",
        });
        await queryClient.invalidateQueries({ queryKey: ["cartridges-list"] });
        setSelectedId(result.id ?? null);
        setSubTab("identity");
      } else {
        const firstErrors = (result.errors ?? []).slice(0, 3).join(" | ");
        toast({
          title: "نصب انجام نشد (fail-closed)",
          description: `${result.reason ?? ""}${firstErrors ? ` — ${firstErrors}` : ""}${
            (result.errors?.length ?? 0) > 3 ? ` و ${faNum((result.errors?.length ?? 0) - 3)} خطای دیگر` : ""
          }`,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "خطا در نصب خشاب",
        description: err instanceof Error ? err.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setInstalling(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── حالت‌های بارگذاری/خطا ───
  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (listQuery.isError) {
    return <ErrorCard onRetry={() => void listQuery.refetch()} />;
  }

  const detail = detailQuery.data;
  const validation = detail?.cartridge.validation ?? null;
  const stats = validation?.stats ?? null;
  const gate = validation?.gate ?? null;
  const warnings = validation?.warnings ?? [];
  const title = detail ? identityValue(detail.cartridge.identity, "عنوان فارسی خشاب") : null;

  return (
    <div className="space-y-4">
      {/* نوار توضیح + نصب */}
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <PackageOpen className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-xs leading-6 text-emerald-900 sm:text-sm">
            نصب خشاب، بازبینی کامل محتوا و حکم زندهٔ موتور تشخیص — خشاب قرمز (خطادار) هرگز نصب نمی‌شود.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="انتخاب فایل JSON خشاب"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
            }}
          />
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={installing}
          >
            <Upload className="size-4" aria-hidden />
            {installing ? "در حال نصب…" : "نصب خشاب (JSON)"}
          </Button>
        </div>
      </div>

      {/* فهرست خشاب‌های نصب‌شده */}
      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title="هیچ خشابی نصب نیست"
              description="فایل JSON خروجی مبدل را با دکمهٔ «نصب خشاب» وارد کنید."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="خشاب‌های نصب‌شده">
          {list.map((item) => (
            <CartridgeChip
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => {
                setSelectedId(item.id);
                setSubTab("identity");
              }}
            />
          ))}
        </div>
      )}

      {/* جزئیات خشاب انتخابی */}
      {selectedId && detailQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
      ) : null}
      {selectedId && detailQuery.isError ? (
        <ErrorCard onRetry={() => void detailQuery.refetch()} />
      ) : null}

      {selectedId && detail ? (
        <Tabs
          value={subTab}
          onValueChange={(v) => setSubTab(v as SubTab)}
          className="w-full"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
            <TabsTrigger value="identity" className="gap-1.5">
              <Package className="size-4" aria-hidden />
              شناسنامه
            </TabsTrigger>
            <TabsTrigger value="bookmap" className="gap-1.5">
              <BookOpen className="size-4" aria-hidden />
              نقشهٔ کتاب ({faNum(detail.bookMap.length)})
            </TabsTrigger>
            <TabsTrigger value="atlas" className="gap-1.5">
              <Bug className="size-4" aria-hidden />
              اطلس خطا ({faNum(detail.atlas.length)})
            </TabsTrigger>
            <TabsTrigger value="bank" className="gap-1.5">
              <ListChecks className="size-4" aria-hidden />
              بانک سؤال ({faNum(detail.bank.length)})
            </TabsTrigger>
          </TabsList>

          {/* ── شناسنامه ── */}
          <TabsContent value="identity" className="mt-4">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    شناسنامهٔ خشاب
                    {detail.cartridge.cartridgeId ? (
                      <span dir="ltr" className="font-mono text-sm font-bold text-emerald-700">
                        {detail.cartridge.cartridgeId}
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
                    {detail.cartridge.source?.file ? (
                      <span className="inline-flex items-center gap-1">
                        <FileSpreadsheet className="size-3.5" aria-hidden />
                        منبع: {detail.cartridge.source.file}
                      </span>
                    ) : null}
                    {detail.cartridge.source?.tool ? <span dir="ltr">{detail.cartridge.source.tool}</span> : null}
                    <span>زمان تولید: {faDateTime(detail.cartridge.generatedAt)}</span>
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

              {/* همهٔ فیلدهای شناسنامه */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">فیلدهای شناسنامه</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.cartridge.identity.length === 0 ? (
                    <EmptyState
                      title="شناسنامه خالی است"
                      description="این خشاب فیلدهای شناسنامه ندارد."
                    />
                  ) : (
                    <ul className="custom-scroll max-h-72 space-y-2 overflow-y-auto pe-1">
                      {detail.cartridge.identity.map((f, i) => (
                        <li
                          key={i}
                          className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:flex-row sm:items-center sm:gap-2"
                        >
                          <span className="w-44 shrink-0 text-xs font-semibold text-slate-700">
                            {f.field}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={f.value ?? undefined}>
                            {f.value || "—"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("w-fit shrink-0 px-2 py-0 text-[10px]", statusBadgeClass(f.status))}
                          >
                            {f.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── نقشهٔ کتاب ── */}
          <TabsContent value="bookmap" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  نقشهٔ کتاب{" "}
                  <span className="text-sm font-normal text-slate-400">
                    ({faNum(detail.bookMap.length)} درس — اسکلت و لنگرهای محتوا)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.bookMap.length === 0 ? (
                  <EmptyState
                    title="نقشهٔ کتاب این خشاب خالی است"
                    description="این خشاب هنوز ردیف نقشهٔ کتاب (S1) ندارد."
                  />
                ) : (
                  <BookMapTable rows={detail.bookMap} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── اطلس خطا ── */}
          <TabsContent value="atlas" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  اطلس خطا{" "}
                  <span className="text-sm font-normal text-slate-400">
                    ({faNum(detail.atlas.length)} کد — باکسی از خطاهای مفهومی شناخته‌شده)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.atlas.length === 0 ? (
                  <EmptyState
                    title="اطلس خطای این خشاب خالی است"
                    description="این خشاب هنوز کد خطای ثبت‌شده ندارد."
                  />
                ) : (
                  <ul className="custom-scroll max-h-96 space-y-3 overflow-y-auto pe-1">
                    {detail.atlas.map((row, i) => (
                      <AtlasRow key={`${row.code ?? "بدون-کد"}-${i}`} row={row} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── بانک سؤال ── */}
          <TabsContent value="bank" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  بانک سؤال{" "}
                  <span className="text-sm font-normal text-slate-400">
                    ({faNum(detail.bank.length)} سؤال — حکم موتور روی گزینه‌های انحرافی)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.bank.length === 0 ? (
                  <EmptyState
                    title="بانک سؤال خالی است"
                    description="این خشاب هنوز سؤالی ندارد — با مبدل خشاب بازتولید کنید."
                  />
                ) : (
                  <ul className="custom-scroll max-h-96 space-y-3 overflow-y-auto pe-1">
                    {detail.bank.map((q) => (
                      <QuestionRow key={q.id} q={q} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
