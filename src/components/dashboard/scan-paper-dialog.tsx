"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileImage,
  ImageOff,
  Loader2,
  ScanLine,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { errorBarClass } from "@/components/dashboard/accuracy-badge";
import { analyzePaper, fetchStudents } from "@/components/dashboard/api";
import { faNum, faPercent } from "@/lib/dashboard/constants";
import type { ScanPaperAnalyzeResponse } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 6 * 1024 * 1024; // سقف ۶ مگابایت — هم‌راستا با سقف سمت سرور

interface ScanPaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScanPaperDialog({ open, onOpenChange }: ScanPaperDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>("");
  const [studentError, setStudentError] = useState(false);

  const studentsQuery = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    enabled: open,
  });
  const students = studentsQuery.data?.students ?? [];
  const selectedStudentName = students.find((s) => s.id === studentId)?.name;

  const resetState = useCallback(() => {
    setFileName(null);
    setDataUrl(null);
    setFileError(null);
    setStudentId("");
    setStudentError(false);
  }, []);

  const mutation = useMutation({
    mutationFn: (vars: { dataUrl: string; commit: boolean; studentId?: string }) =>
      analyzePaper(vars.dataUrl, vars.commit, vars.studentId),
    onSuccess: (result, vars) => {
      if (!vars.commit) return;
      if (result.stored && result.stored > 0) {
        toast({
          title: `${faNum(result.stored)} نتیجه به پروندهٔ ${selectedStudentName ?? "دانش‌آموز"} اضافه شد`,
          description: "نتایج برگهٔ کاغذی در پیشرفت و گلوگاه‌های همان دانش‌آموز ثبت شد.",
        });
        void queryClient.invalidateQueries({ queryKey: ["students"] });
        void queryClient.invalidateQueries({ queryKey: ["overview"] });
        void queryClient.invalidateQueries({ queryKey: ["bottlenecks"] });
        void queryClient.invalidateQueries({ queryKey: ["student-detail"] });
        onOpenChange(false);
      } else {
        toast({
          title: "نتیجه‌ای برای ثبت یافت نشد",
          description: "در تحلیل برگه مسئلهٔ قابل‌ثبتی پیدا نشد؛ برگهٔ واضح‌تری انتخاب کنید.",
          variant: "destructive",
        });
      }
    },
    onError: (_error, vars) => {
      toast({
        title: vars.commit ? "خطا در ثبت برگه" : "خطا در تحلیل برگه",
        description: "فراخوانی هوش مصنوعی ناموفق بود. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    },
  });

  const isAnalyzing = mutation.isPending && mutation.variables?.commit === false;
  const isCommitting = mutation.isPending && mutation.variables?.commit === true;
  const result: ScanPaperAnalyzeResponse | undefined = mutation.data;

  const handleFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    setFileError(null);
    if (!file.type.startsWith("image/")) {
      setFileError("فایل انتخاب‌شده تصویر نیست؛ لطفاً عکس برگه را انتخاب کنید.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("حجم عکس بیش از ۶ مگابایت است؛ لطفاً عکس کوچک‌تری انتخاب کنید.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError("خواندن فایل ناموفق بود؛ دوباره تلاش کنید.");
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDataUrl(reader.result);
        setFileName(file.name);
      } else {
        setFileError("خواندن فایل ناموفق بود؛ دوباره تلاش کنید.");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCommit = () => {
    if (!studentId) {
      setStudentError(true);
      return;
    }
    setStudentError(false);
    if (dataUrl) {
      mutation.mutate({ dataUrl, commit: true, studentId });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetState();
          mutation.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg custom-scroll"
      >
        {/* نکتهٔ a11y: Radix خودش aria-describedby را به DialogDescription وصل می‌کند */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-emerald-600" aria-hidden />
            اسکن برگهٔ کاغذی
          </DialogTitle>
          <DialogDescription>
            عکس برگهٔ تمرین ضرب دانش‌آموز را بگیرید؛ هوش مصنوعی مسائل و اشتباه‌ها را استخراج و در
            پیشرفت همان دانش‌آموز ثبت می‌کند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* انتخاب دانش‌آموز — فقط برای ثبت نتیجه الزامی است */}
          <div className="space-y-1.5">
            <Label htmlFor="scan-paper-student" className="text-sm text-slate-700">
              دانش‌آموز (برای ثبت نتیجه)
            </Label>
            {studentsQuery.isLoading ? (
              <Skeleton className="h-11 w-full rounded-md" />
            ) : (
              <Select
                value={studentId}
                onValueChange={(value) => {
                  setStudentId(value);
                  setStudentError(false);
                }}
              >
                <SelectTrigger
                  id="scan-paper-student"
                  className="w-full min-h-11"
                  aria-invalid={studentError}
                >
                  <SelectValue placeholder="انتخاب دانش‌آموز…" />
                </SelectTrigger>
                <SelectContent className="max-h-64 custom-scroll">
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — پایه {faNum(s.grade)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {studentError ? (
              <p className="text-xs font-medium text-rose-600" role="alert">
                برای ثبت نتیجه، ابتدا دانش‌آموز را انتخاب کنید.
              </p>
            ) : null}
          </div>

          {/* آپلود عکس برگه */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">عکس برگه</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                className="min-h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-600"
              >
                <FileImage className="size-4" aria-hidden />
                انتخاب عکس برگه
              </Button>
              {fileName ? (
                <span className="min-w-0 truncate text-xs text-slate-500">{fileName}</span>
              ) : (
                <span className="text-xs text-slate-400">PNG یا JPEG · حداکثر ۶ مگابایت</span>
              )}
            </div>
            {fileError ? (
              <p className="text-xs font-medium text-rose-600" role="alert">
                {fileError}
              </p>
            ) : null}
            {dataUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <img
                  src={dataUrl}
                  alt="پیش‌نمایش برگهٔ تمرین انتخاب‌شده"
                  className="mx-auto max-h-48 rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center">
                <ImageOff className="mx-auto size-5 text-slate-300" aria-hidden />
                <p className="text-xs text-slate-400">
                  هنوز عکسی انتخاب نشده است؛ می‌توانید مستقیم از دوربین گوشی عکس بگیرید.
                </p>
              </div>
            )}
          </div>

          {/* دکمهٔ تحلیل */}
          <Button
            type="button"
            onClick={() => dataUrl && mutation.mutate({ dataUrl, commit: false })}
            disabled={!dataUrl || mutation.isPending}
            className="min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600"
          >
            {isAnalyzing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ScanLine className="size-4" aria-hidden />
            )}
            {isAnalyzing ? "در حال تحلیل برگه…" : "تحلیل برگه"}
          </Button>

          {/* حالت لود تحلیل */}
          {isAnalyzing ? (
            <div className="space-y-2" role="status" aria-live="polite">
              <p className="text-xs text-emerald-700">
                هوش مصنوعی مسائل برگه را می‌خواند؛ این کار ممکن است تا ۱۵ ثانیه طول بکشد.
              </p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : null}

          {mutation.isError && !mutation.isPending ? (
            <p className="text-xs font-medium text-rose-600" role="alert">
              تحلیل برگه ناموفق بود؛ دوباره روی «تحلیل برگه» بزنید.
            </p>
          ) : null}

          {/* نتیجهٔ تحلیل */}
          {result && !mutation.isPending ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div aria-live="polite" className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-700"
                >
                  تعداد مسئله: {faNum(result.total)}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  تعداد درست: {faNum(result.correct)}
                </Badge>
              </div>

              {result.unreadable > 0 ? (
                <p className="flex items-start gap-1.5 text-xs leading-5 text-amber-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {faNum(result.unreadable)} مسئلهٔ ناخوانا از تحلیل کنار گذاشته شد.
                </p>
              ) : null}

              {result.factStats.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-700">فاکتورهای اشتباه</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {result.factStats.map((f) => (
                      <li
                        key={f.fact}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                      >
                        <span dir="ltr" className="font-mono text-sm font-bold text-slate-800">
                          {f.fact}
                        </span>
                        <span
                          className={cn("h-1.5 w-10 shrink-0 rounded-full", errorBarClass(f.errorRate))}
                          aria-hidden
                        />
                        <span className="text-[11px] text-slate-500">{faPercent(f.errorRate, 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-emerald-700">در این برگه اشتباهی یافت نشد؛ آفرین!</p>
              )}

              {result.notes ? (
                <p className="text-xs leading-6 text-slate-600">
                  <span className="font-semibold text-slate-700">مشاهدات: </span>
                  {result.notes}
                </p>
              ) : null}

              {/* ثبت در داشبورد */}
              {isCommitting ? (
                <p className="text-xs text-emerald-700" role="status" aria-live="polite">
                  در حال ثبت نتایج در پروندهٔ دانش‌آموز؛ تا ۱۵ ثانیه صبر کنید…
                </p>
              ) : null}
              <Button
                type="button"
                onClick={handleCommit}
                disabled={mutation.isPending}
                className="min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600"
              >
                {isCommitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                {isCommitting ? "در حال ثبت…" : "ثبت در داشبورد"}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
