"use client";

// تب «بازرسی محتوا» (BP-004 — گام ۳ دستورکار ۶۰–۶۶)
// معلم بدون گیت می‌بیند: سر رسمی هر خانواده + نامزد تحویل آرنا + حکم گیت کارگاه‌بان،
// و رأی تربیتی‌اش را با «مُهر» ثبت می‌کند؛ مُهر در فایل ثبت رسمی می‌نشیند
// (authoring/teacher-stamps.json) و کارگاه‌بان آن را به تابلوی مرکزی دیسپچ می‌کند.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileCheck2, Gavel, RefreshCw, Stamp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorCard, EmptyState } from "@/components/dashboard/state-views";
import { useToast } from "@/hooks/use-toast";
import { faDateTime, faNum } from "@/lib/dashboard/constants";

type HeadRow = {
  family: string;
  file: string;
  sha256: string;
  version: string | null;
  status: string | null;
};

type CandidateRow = {
  branch: string;
  sha: string | null;
  verdict: string | null;
  prNumber: number | null;
  prUrl: string | null;
  note: string | null;
  processedAt: string | null;
};

type StampRow = {
  id: string;
  ts: string;
  family: string;
  officialSha: string;
  candidateBranch: string | null;
  candidateSha: string | null;
  verdict: "approve" | "reject" | "needs_changes";
  note: string;
  by: string;
};

type TeacherReviewResponse = {
  schema: string;
  generatedAt: string;
  officialHeads: HeadRow[];
  manifestOk: boolean;
  candidates: CandidateRow[];
  stamps: StampRow[];
};

async function fetchTeacherReview(): Promise<TeacherReviewResponse> {
  const res = await fetch("/api/teacher-review", { cache: "no-store" });
  if (!res.ok) throw new Error(`خطای سرور (${res.status})`);
  return (await res.json()) as TeacherReviewResponse;
}

const VERDICT_FA: Record<string, string> = {
  GREEN_SYNC: "🟢 هم‌گام با سرهای رسمی",
  GREEN_NEWER: "🟢 جدیدتر از سر رسمی",
  YELLOW: "🟡 نیازمند بازرسی دوم",
  RED_STALE_BASE: "🔴 پایهٔ کهنه (INC-07) — rebase لازم است",
  RED: "🔴 مردود",
  BLOCKED: "⛔ متوقف",
};

const STAMP_FA: Record<StampRow["verdict"], string> = {
  approve: "تأیید معلم",
  reject: "رد معلم",
  needs_changes: "نیازمند اصلاح",
};

function shaShort(sha: string | null | undefined) {
  return sha ? sha.slice(0, 7) : "—";
}

export function TeacherReviewTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const reviewQuery = useQuery({
    queryKey: ["teacher-review"],
    queryFn: fetchTeacherReview,
    refetchInterval: 60_000,
  });

  // توکن معلم — فقط سمت سرور اعتبار می‌گیرد (T3). در sessionStorage می‌ماند تا
  // بارگذاری مجدد صفحه نیاز به تکرار نداشته باشد؛ هرگز به سرور دیگری نمی‌رود.
  const [stampToken, setStampToken] = useState<string>(
    () => (typeof window !== "undefined" ? sessionStorage.getItem("khshab-stamp-token") ?? "" : "")
  );
  const rememberToken = (t: string) => {
    setStampToken(t);
    if (typeof window !== "undefined") {
      if (t) sessionStorage.setItem("khshab-stamp-token", t);
      else sessionStorage.removeItem("khshab-stamp-token");
    }
  };

  const stampMutation = useMutation({
    mutationFn: async (args: { family: string; verdict: StampRow["verdict"] }) => {
      const candidate = reviewQuery.data?.candidates.find((c) =>
        c.verdict?.startsWith("GREEN")
      );
      if (!stampToken.trim()) {
        throw new Error(
          "ثبت مُهر نیازمند توکن احراز هویت معلم است — توکن را در کادر پایین وارد کنید (T3)."
        );
      }
      const res = await fetch("/api/teacher-review/stamp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${stampToken.trim()}`,
        },
        body: JSON.stringify({
          family: args.family,
          verdict: args.verdict,
          note,
          candidateBranch: candidate?.branch ?? null,
          candidateSha: candidate?.sha ?? null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const hint =
          res.status === 503
            ? " (سرور توکن تنظیم نکرده — fail-closed)"
            : res.status === 401
              ? " (توکن نامعتبر یا غایب — نقش ارسالی جای احراز هویت را نمی‌گیرد)"
              : "";
        throw new Error((j.error || `خطای سرور (${res.status})`) + hint);
      }
      return (await res.json()) as { ok: boolean; stamp: StampRow };
    },
    onSuccess: (data) => {
      toast({
        title: "مُهر ثبت شد",
        description: `رأی «${STAMP_FA[data.stamp.verdict]}» روی ${data.stamp.family} در فایل ثبت رسمی نشست؛ کارگاه‌بان به تابلو می‌برد.`,
      });
      setNote("");
      setSelectedFamily(null);
      void queryClient.invalidateQueries({ queryKey: ["teacher-review"] });
    },
    onError: (e: Error) => {
      toast({ title: "ثبت مُهر ناموفق", description: e.message, variant: "destructive" });
    },
  });

  const data = reviewQuery.data;

  return (
    <div className="space-y-6">
      {/* سرهای رسمی */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck2 className="size-4 text-emerald-700" aria-hidden />
            سرهای رسمی (مانیفست OFFICIAL-HEADS)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reviewQuery.refetch()}
            aria-label="بازخوانی"
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </CardHeader>
        <CardContent>
          {reviewQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ) : reviewQuery.isError ? (
            <ErrorCard
              title="دریافت داده‌های بازرسی ناموفق بود"
              onRetry={() => void reviewQuery.refetch()}
            />
          ) : !data || !data.officialHeads.length ? (
            <EmptyState
              title="مانیفست سرهای رسمی یافت نشد"
              description="فایل OFFICIAL-HEADS.json در مخزن نیست."
            />
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>خانواده</TableHead>
                    <TableHead>نسخه</TableHead>
                    <TableHead>SHA</TableHead>
                    <TableHead className="hidden md:table-cell">وضعیت</TableHead>
                    <TableHead className="sr-only">عمل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.officialHeads.map((h) => (
                    <TableRow key={h.family}>
                      <TableCell className="font-medium">{h.family}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{h.version ?? "؟"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        {shaShort(h.sha256)}
                      </TableCell>
                      <TableCell className="hidden max-w-64 truncate text-xs text-slate-500 md:table-cell">
                        {h.status ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFamily(selectedFamily === h.family ? null : h.family)}
                          aria-label={`مهر برای ${h.family}`}
                        >
                          <Stamp className="size-3.5" aria-hidden />
                          مُهر
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* فرم مُهر معلم */}
      {selectedFamily && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="size-4 text-emerald-700" aria-hidden />
              رأی تربیتی برای {selectedFamily}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
              <label htmlFor="stamp-token" className="block text-xs font-medium text-amber-900">
                توکن احراز هویت معلم (T3) — هویت ثبت مُهر فقط با این توکن سمت سرور اثبات می‌شود؛
                نام یا نقش ارسالی جای آن را نمی‌گیرد.
              </label>
              <Input
                id="stamp-token"
                type="password"
                dir="ltr"
                autoComplete="off"
                value={stampToken}
                onChange={(e) => rememberToken(e.target.value)}
                placeholder="TEACHER_STAMP_TOKEN"
                aria-label="توکن احراز هویت معلم"
              />
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="توضیح رأی (اختیاری) — مثلاً: نمونه‌گیری صفحه‌ای انجام شد، سه سؤال فصل ۴ نیازمند اصلاح است…"
              rows={3}
              aria-label="توضیح رأی معلم"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800"
                disabled={stampMutation.isPending}
                onClick={() => stampMutation.mutate({ family: selectedFamily, verdict: "approve" })}
              >
                <BadgeCheck className="size-4" aria-hidden />
                تأیید
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={stampMutation.isPending}
                onClick={() => stampMutation.mutate({ family: selectedFamily, verdict: "needs_changes" })}
              >
                نیازمند اصلاح
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={stampMutation.isPending}
                onClick={() => stampMutation.mutate({ family: selectedFamily, verdict: "reject" })}
              >
                رد
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedFamily(null)}>
                بستن
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* نامزدهای آرنا */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">نامزدهای تحویل آرنا (حکم کارگاه‌بان)</CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.candidates.length ? (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شاخه</TableHead>
                    <TableHead>هد</TableHead>
                    <TableHead>حکم گیت</TableHead>
                    <TableHead className="hidden sm:table-cell">PR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.candidates.map((c) => (
                    <TableRow key={c.branch}>
                      <TableCell className="text-xs" dir="ltr">
                        {c.branch}
                      </TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        {shaShort(c.sha)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {VERDICT_FA[c.verdict ?? ""] ?? (c.verdict ?? "—")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.prUrl ? (
                          <a
                            href={c.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-emerald-700 hover:underline"
                          >
                            #{faNum(c.prNumber ?? 0)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="نامزدی در صف نیست"
              description="وقتی آرنا تحویل تازه‌ای پوش کند، حکم کارگاه‌بان اینجا نمایش داده می‌شود."
            />
          )}
        </CardContent>
      </Card>

      {/* مُهرهای ثبت‌شده */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            مُهرهای ثبت‌شدهٔ معلم ({faNum(data?.stamps.length ?? 0)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.stamps.length ? (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>خانواده</TableHead>
                    <TableHead>رأی</TableHead>
                    <TableHead className="hidden md:table-cell">توضیح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stamps
                    .slice()
                    .reverse()
                    .map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{faDateTime(s.ts)}</TableCell>
                        <TableCell className="font-medium">{s.family}</TableCell>
                        <TableCell>
                          <Badge
                            variant={s.verdict === "approve" ? "default" : s.verdict === "reject" ? "destructive" : "outline"}
                            className={s.verdict === "approve" ? "bg-emerald-700" : ""}
                          >
                            {STAMP_FA[s.verdict] ?? s.verdict}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-72 truncate text-xs text-slate-500 md:table-cell">
                          {s.note || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="هنوز مُهری ثبت نشده"
              description="اولین رأی تربیتی شما با دکمهٔ «مُهر» در جدول سرهای رسمی ثبت می‌شود."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
