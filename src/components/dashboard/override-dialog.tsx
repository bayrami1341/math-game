"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PenLine } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { postOverride } from "@/components/dashboard/api";
import { faNum } from "@/lib/dashboard/constants";
import { ERROR_CODE_LIST } from "@/lib/dashboard/error-model";

const NOTE_MAX = 500; // هم‌راستا با سقف سمت سرور (zod)

interface OverrideDialogProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalCode: string;
  originalTitleFa: string;
}

/**
 * دیالوگ «بازنویسی تشخیص بالینی» (CEAP §9.2)
 * تشخیص الگوریتم هرگز حذف/ویرایش نمی‌شود؛ بازنویسی معلم فقط‌الحاقی با برچسب TEACHER_OVERRIDE بایگانی می‌شود.
 */
export function OverrideDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  originalCode,
  originalTitleFa,
}: OverrideDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [overrideCode, setOverrideCode] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [codeError, setCodeError] = useState(false);

  const resetState = useCallback(() => {
    setOverrideCode("");
    setNote("");
    setCodeError(false);
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      postOverride({
        studentId,
        originalCode,
        overrideCode,
        note: note.trim() ? note.trim() : undefined,
      }),
    onSuccess: () => {
      toast({
        title: "تشخیص بازنویسی شد",
        description: `تشخیص الگوریتم برای ${studentName} دست‌نخورده باقی ماند و بازنویسی شما در تاریخچهٔ TEACHER_OVERRIDE بایگانی شد.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["student-detail", studentId] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "خطا در ثبت بازنویسی",
        description: "ثبت بازنویسی تشخیص ناموفق بود. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!overrideCode) {
      setCodeError(true);
      return;
    }
    setCodeError(false);
    mutation.mutate();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg custom-scroll">
        {/* نکتهٔ a11y: Radix خودش aria-describedby را به DialogDescription وصل می‌کند */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-5 text-emerald-600" aria-hidden />
            بازنویسی تشخیص بالینی
          </DialogTitle>
          <DialogDescription>
            تشخیص اولیه حذف نمی‌شود و در تاریخچه با برچسب TEACHER_OVERRIDE بایگانی می‌شود (CEAP §9.2).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* تشخیص فعلی الگوریتم */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[11px] font-medium text-slate-500">
              تشخیص فعلی الگوریتم برای {studentName}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                dir="ltr"
                className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700"
              >
                {originalCode}
              </span>
              <span className="text-sm font-semibold text-slate-800">{originalTitleFa}</span>
            </div>
          </div>

          {/* انتخاب کد جدید */}
          <div className="space-y-1.5">
            <Label htmlFor="override-code" className="text-sm text-slate-700">
              تشخیص جدید معلم
            </Label>
            <Select
              value={overrideCode}
              onValueChange={(value) => {
                setOverrideCode(value);
                setCodeError(false);
              }}
            >
              <SelectTrigger
                id="override-code"
                className="w-full min-h-11"
                aria-invalid={codeError}
              >
                <SelectValue placeholder="انتخاب کد تشخیص…" />
              </SelectTrigger>
              <SelectContent className="max-h-64 custom-scroll">
                {ERROR_CODE_LIST.map((meta) => (
                  <SelectItem key={meta.code} value={meta.code}>
                    {meta.titleFa} ({meta.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {codeError ? (
              <p className="text-xs font-medium text-rose-600" role="alert">
                برای ثبت بازنویسی، ابتدا تشخیص جدید را انتخاب کنید.
              </p>
            ) : null}
          </div>

          {/* یادداشت معلم */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="override-note" className="text-sm text-slate-700">
                یادداشت معلم (اختیاری)
              </Label>
              <span className="text-[11px] tabular-nums text-slate-400" aria-hidden>
                {faNum(note.length)} / {faNum(NOTE_MAX)}
              </span>
            </div>
            <Textarea
              id="override-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder="مثلاً: در مصاحبهٔ کلامی، دانش‌آموز مفهوم ضرب را درست توضیح داد؛ خطاها به خستگی بود…"
              className="min-h-11 resize-none leading-6"
            />
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <PenLine className="size-4" aria-hidden />
            )}
            {mutation.isPending ? "در حال ثبت…" : "ثبت بازنویسی"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
