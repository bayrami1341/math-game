// تب «ماتریس دامنه‌ها» — بازرسی انسانی و مُهر گام صفر (گام صفر ریل اعتماد BP-021)
// اصل حاکمیتی: فقط انسان مُهر می‌زند؛ AI فقط نمایش‌دهنده و ثبت‌کنندهٔ رسید است.

"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpen,
  ClipboardList,
  Hash,
  Landmark,
  Loader2,
  Stamp,
  TriangleAlert,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  fetchDomainMatrix,
  postDomainMatrixStamp,
  type DomainMatrixResponse,
} from "@/components/dashboard/api";
import type {
  DomainMatrixDomain,
  DomainMatrixFamily,
  StepZeroReceipt,
} from "@/lib/dashboard/domain-matrix";

// ---------- قالب‌بندی فارسی (بدون وابستگی به ICU برای جلوگیری از ناسازگاری هیدریشن) ----------
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (value: number | string): string =>
  String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

const shortSha = (sha: string): string =>
  sha.length > 18 ? `${sha.slice(0, 10)}…${sha.slice(-6)}` : sha;

const FAMILY_LABELS: Record<string, string> = {
  "KH-G3-MATH": "پایهٔ سوم ابتدایی (کد ۳۰۵)",
  "KH-G2-MATH": "پایهٔ دوم ابتدایی",
};

// ---------- نمایش یک دامنه ----------
function DomainCard({ code, domain }: { code: string; domain: DomainMatrixDomain }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 font-bold text-emerald-800">
          {code}
        </Badge>
        <Badge variant="outline" className="border-slate-300 text-slate-600">
          {domain.chapter}
        </Badge>
        <Badge className="bg-emerald-600 text-white">
          حداقل {faNum(domain.min)} سؤال
        </Badge>
      </div>
      <h4 className="mb-2 text-sm font-bold text-slate-900">{domain.title}</h4>
      <div className="flex flex-wrap gap-1">
        {domain.qTypes.map((qt) => (
          <span
            key={qt}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] leading-5 text-slate-600"
          >
            {qt}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- نمایش یک کتاب (خانواده) ----------
function FamilyCard({ familyKey, family }: { familyKey: string; family: DomainMatrixFamily }) {
  const domainEntries = Object.entries(family.domains);
  const sum = domainEntries.reduce((acc, [, d]) => acc + d.min, 0);
  const matches = sum === family.minTotal;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="size-5 shrink-0 text-emerald-700" aria-hidden />
            <div className="min-w-0">
              <CardTitle className="text-base">{family.title}</CardTitle>
              <CardDescription className="truncate text-xs">
                {FAMILY_LABELS[familyKey] ?? familyKey} · {faNum(domainEntries.length)} دامنه
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
            الزام گیت: {faNum(family.minTotal)} سؤال
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            matches
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {matches ? (
            <BadgeCheck className="size-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
          )}
          {matches ? (
            <span>
              راستی‌آزمایی جمع: {domainEntries.map(([, d]) => faNum(d.min)).join(" + ")} ={" "}
              <span className="font-bold">{faNum(sum)}</span> — با الزام گیت می‌خواند.
            </span>
          ) : (
            <span>
              ناسازگاری: جمع حداقل‌ها {faNum(sum)} است ولی الزام گیت {faNum(family.minTotal)} است.
            </span>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {domainEntries.map(([code, d]) => (
            <DomainCard key={code} code={code} domain={d} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- کارت رسید مُهر ----------
function ReceiptCard({ receipt }: { receipt: StepZeroReceipt }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BadgeCheck className="size-5 text-emerald-700" aria-hidden />
          <span className="text-sm font-bold text-emerald-900">
            مُهر ثبت شد — {receipt.teacherName}
          </span>
        </div>
        <Badge variant="outline" className="border-emerald-300 bg-white text-[10px] text-emerald-800">
          {receipt.id}
        </Badge>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs text-slate-700">
        <div className="flex flex-wrap gap-1">
          <dt className="font-medium text-slate-500">زمان ثبت:</dt>
          <dd>{receipt.recordedAtTehran}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <dt className="font-medium text-slate-500">مُهر بسته‌شده به محتوا (SHA-256):</dt>
          <dd className="font-mono tabular-nums" title={receipt.matrixSha256}>
            {shortSha(receipt.matrixSha256)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-1">
          <dt className="font-medium text-slate-500">وضعیت رسمی:</dt>
          <dd className="font-medium text-amber-700">{receipt.officialStatus}</dd>
        </div>
        {receipt.note ? (
          <div className="flex flex-wrap gap-1">
            <dt className="font-medium text-slate-500">یادداشت:</dt>
            <dd>{receipt.note}</dd>
          </div>
        ) : null}
      </dl>
      <Alert className="mt-3 border-amber-300 bg-amber-50">
        <TriangleAlert className="size-4 text-amber-600" aria-hidden />
        <AlertDescription className="text-xs leading-6 text-amber-900">
          این رسید در داشبورد ثبت شد. برای قفل رسمی ماتریس در مخزن (به‌روزرسانی status از DRAFT به
          قفل‌شده + رجیستری + CI)، در چت به Z.ai بگویید «مُهر زدم؛ ثبت رسمی کن». تا آن لحظه نسخهٔ
          مخزن رسمی DRAFT می‌ماند.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ---------- ایستگاه مُهر ----------
function StampStation({ data }: { data: DomainMatrixResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [teacherName, setTeacherName] = useState("");
  const [chaptersMatchBook, setChaptersMatchBook] = useState(false);
  const [minCountsAgreed, setMinCountsAgreed] = useState(false);
  const [questionTypesAgreed, setQuestionTypesAgreed] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allConfirmed = chaptersMatchBook && minCountsAgreed && questionTypesAgreed;
  const nameValid = teacherName.trim().length >= 3;
  const canSubmit = nameValid && allConfirmed && !submitting && !data.alreadyStamped;

  const confirmations = useMemo(
    () => ({ chaptersMatchBook, minCountsAgreed, questionTypesAgreed }),
    [chaptersMatchBook, minCountsAgreed, questionTypesAgreed]
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await postDomainMatrixStamp({
        teacherName: teacherName.trim(),
        matrixSha256: data.sha256,
        confirmations,
        note: note.trim(),
      });
      toast({
        title: "مُهر گام صفر ثبت شد",
        description: `رسید ${res.receipt.id} ساخته شد؛ ثبت رسمی در مخزن پس از تأیید شما در چت.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["domain-matrix"] });
    } catch (err) {
      toast({
        title: "مُهر ثبت نشد",
        description: err instanceof Error ? err.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (data.alreadyStamped) {
    const receipt = data.receipts.find(
      (r) => r.matrixSha256 === data.sha256 && r.officialStatus !== "REJECTED"
    );
    return receipt ? (
      <ReceiptCard receipt={receipt} />
    ) : null;
  }

  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Stamp className="size-5 text-emerald-700" aria-hidden />
          <CardTitle className="text-base">ایستگاه مُهر گام صفر</CardTitle>
        </div>
        <CardDescription className="leading-6">
          این فرم فقط دست انسان می‌پذیرد. با ثبت این مُهر اعلام می‌کنید ماتریس زیر را — با همین هش
          <span className="mx-1 font-mono tabular-nums" title={data.sha256}>
            {shortSha(data.sha256)}
          </span>
          — بازرسی کرده‌اید.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="teacher-name">نام معلم / صاحب کار</Label>
          <Input
            id="teacher-name"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            placeholder="نام و نام خانوادگی"
            autoComplete="name"
            maxLength={80}
          />
          {teacherName.trim().length > 0 && !nameValid ? (
            <p className="text-xs text-amber-700">نام باید حداقل ۳ نویسه باشد.</p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-700">سه تأیید آگاهانه (همه لازم است):</p>
          <label htmlFor="conf-1" className="flex cursor-pointer items-start gap-2 text-xs leading-6 text-slate-700">
            <Checkbox
              id="conf-1"
              checked={chaptersMatchBook}
              onCheckedChange={(v) => setChaptersMatchBook(v === true)}
              className="mt-1"
            />
            <span>
              دامنه‌ها و فصل‌ها را با فهرست فصل‌های کتاب‌های درسی (G3 کد ۳۰۵ و G2) تطبیق دادم.
            </span>
          </label>
          <label htmlFor="conf-2" className="flex cursor-pointer items-start gap-2 text-xs leading-6 text-slate-700">
            <Checkbox
              id="conf-2"
              checked={minCountsAgreed}
              onCheckedChange={(v) => setMinCountsAgreed(v === true)}
              className="mt-1"
            />
            <span>
              با «حداقل سؤال» هر دامنه و «الزام گیت» هر کتاب (G3: ۴۵۲ — G2: ۲۴۲) موافقم.
            </span>
          </label>
          <label htmlFor="conf-3" className="flex cursor-pointer items-start gap-2 text-xs leading-6 text-slate-700">
            <Checkbox
              id="conf-3"
              checked={questionTypesAgreed}
              onCheckedChange={(v) => setQuestionTypesAgreed(v === true)}
              className="mt-1"
            />
            <span>با انواع تمرین (عمق) هر دامنه موافقم.</span>
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stamp-note">یادداشت (اختیاری)</Label>
          <Textarea
            id="stamp-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="هر تغییرخواهی یا شرط همراه مُهر — مثلاً: «D4 حداقلش ۱۲۰ شود»"
            rows={2}
            maxLength={500}
          />
        </div>

        <Button
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
          size="lg"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Stamp className="size-4" aria-hidden />
          )}
          ثبت مُهر گام صفر
        </Button>
        {!canSubmit && !submitting ? (
          <p className="text-xs text-slate-500">
            برای فعال‌شدن دکمه: نام معلم + هر سه تأیید لازم است.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------- تب اصلی ----------
export function DomainMatrixTab() {
  const matrixQuery = useQuery({
    queryKey: ["domain-matrix"],
    queryFn: fetchDomainMatrix,
  });

  const data = matrixQuery.data;
  const isDraft = useMemo(
    () => Boolean(data && data.matrix.status.toUpperCase().startsWith("DRAFT")),
    [data]
  );

  if (matrixQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        در حال بارگذاری ماتریس دامنه‌ها…
      </div>
    );
  }

  if (matrixQuery.isError || !data) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" aria-hidden />
        <AlertTitle>خطا در خواندن ماتریس</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>ماتریس دامنه‌ها از سرور دریافت نشد.</span>
          <Button variant="outline" size="sm" onClick={() => void matrixQuery.refetch()}>
            تلاش دوباره
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const familyEntries = Object.entries(data.matrix.families);
  const totalMin = familyEntries.reduce(
    (acc, [, f]) => acc + Object.values(f.domains).reduce((s, d) => s + d.min, 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* پرچم وضعیت */}
      <Alert className={isDraft ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}>
        <TriangleAlert className="size-4 text-amber-600" aria-hidden />
        <AlertTitle className="text-amber-900">
          وضعیت: {isDraft ? "پیش‌نویس (DRAFT) — در انتظار مُهر گام صفر معلم" : data.matrix.status}
        </AlertTitle>
        <AlertDescription className="text-xs leading-6 text-slate-700">
          طبق «گام صفر» ریل اعتماد: تا مُهر انسان نخورد، همهٔ گزارش‌های پوشش برچسب DRAFT دارند و
          هیچ‌کدام حکم «آمادگی» نمی‌دهند. مُهر را پایین همین صفحه می‌زنید.
        </AlertDescription>
      </Alert>

      {/* شناسنامهٔ سند */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-emerald-700" aria-hidden />
            <CardTitle className="text-base">شناسنامهٔ سند</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs leading-6 text-slate-700">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-wrap gap-1">
              <span className="font-medium text-slate-500">schema:</span>
              <span className="font-mono" dir="ltr">{data.matrix.schema}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="font-medium text-slate-500">آخرین به‌روزرسانی:</span>
              <span>{data.matrix.updatedAt}</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:col-span-2">
              <span className="font-medium text-slate-500">تولیدشده توسط:</span>
              <span>{data.matrix.updatedBy}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="font-medium text-slate-500">منبع سرو‌شده:</span>
              <span dir="ltr" className="font-mono">
                {data.source === "repo" ? `math-game@${data.provenance.repoCommit.slice(0, 8)}` : "local-copy"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Hash className="size-3.5 text-slate-400" aria-hidden />
              <span className="font-medium text-slate-500">SHA-256 محتوا:</span>
              <span className="font-mono tabular-nums" dir="ltr" title={data.sha256}>
                {shortSha(data.sha256)}
              </span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-slate-500">قالب‌های پاسخ:</span>
            {data.matrix.answerFormats.map((f) => (
              <Badge key={f} variant="outline" className="border-slate-300 bg-white text-[11px] font-normal">
                {f}
              </Badge>
            ))}
          </div>
          <p className="text-slate-500">{data.matrix.note}</p>
        </CardContent>
      </Card>

      {/* جمع‌بندی بالای کتاب‌ها */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <ClipboardList className="size-4 text-emerald-700" aria-hidden />
        <span>
          مجموع هر دو کتاب: <span className="font-bold text-slate-900">{faNum(totalMin)}</span> سؤال
          در <span className="font-bold text-slate-900">{faNum(familyEntries.reduce((a, [, f]) => a + Object.keys(f.domains).length, 0))}</span> دامنه
        </span>
      </div>

      {/* کتاب‌ها */}
      {familyEntries.map(([key, family]) => (
        <FamilyCard key={key} familyKey={key} family={family} />
      ))}

      {/* ایستگاه مُهر + تاریخچه */}
      <StampStation data={data} />

      {data.receipts.length > 1 ? (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">تاریخچهٔ رسیدها</CardTitle>
            <CardDescription className="text-xs">
              {faNum(data.receipts.length)} رسید ثبت‌شده در داشبورد
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-56 space-y-2 overflow-y-auto pe-1 [scrollbar-width:thin]">
              {data.receipts.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-800">{r.teacherName}</span>
                  <span className="font-mono tabular-nums text-slate-400" dir="ltr" title={r.matrixSha256}>
                    {shortSha(r.matrixSha256)}
                  </span>
                  <span className="text-slate-500">{r.recordedAtTehran}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
