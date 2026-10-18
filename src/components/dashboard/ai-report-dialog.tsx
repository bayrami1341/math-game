"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown, { type Components } from "react-markdown";
import { Bot, ClipboardCheck, Copy, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { postAiReport } from "@/components/dashboard/api";

const markdownComponents: Components = {
  h2: (props) => (
    <h2 className="mt-4 mb-1.5 text-sm font-bold text-slate-900 first:mt-0" {...props} />
  ),
  h3: (props) => <h3 className="mt-3 mb-1 text-sm font-semibold text-slate-800" {...props} />,
  p: (props) => <p className="text-sm leading-7 text-slate-700" {...props} />,
  ul: (props) => (
    <ul
      className="mt-2 list-disc space-y-1 pr-5 text-sm leading-6 text-slate-700"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-2 list-decimal space-y-1 pr-5 text-sm leading-6 text-slate-700"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-bold text-slate-900" {...props} />,
};

interface AiReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiReportDialog({ open, onOpenChange }: AiReportDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: postAiReport,
    onError: () => {
      toast({
        title: "خطا در تولید گزارش",
        description: "ساخت گزارش هوشمند ناموفق بود. لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    },
  });

  const report = mutation.data;

  const copyReport = async () => {
    if (!report) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        // جایگزین برای محیط‌های بدون Clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = report;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({ title: "گزارش کپی شد", description: "متن گزارش در کلیپ‌بورد قرار گرفت." });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "کپی ناموفق بود",
        description: "دسترسی به کلیپ‌بورد ممکن نیست.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCopied(false);
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto sm:max-w-lg custom-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-5 text-emerald-600" aria-hidden />
            گزارش هوشمند کلاس
          </DialogTitle>
          <DialogDescription>تحلیل خودکار بر اساس داده‌های واقعی دیتابیس</DialogDescription>
        </DialogHeader>

        {!report && !mutation.isPending && !mutation.isError ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="max-w-xs text-sm leading-6 text-slate-600">
              گزارشی کوتاه و کاربردی از وضعیت کلی کلاس، گلوگاه‌های یادگیری و پیشنهاد جلسهٔ بعد برای شما تولید می‌شود.
            </p>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Sparkles className="size-4" aria-hidden />
              تولید گزارش
            </Button>
          </div>
        ) : null}

        {mutation.isPending ? (
          <div className="space-y-3 py-2" role="status" aria-live="polite">
            <p className="text-sm text-emerald-700">در حال تحلیل داده‌های کلاس...</p>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : null}

        {mutation.isError && !mutation.isPending ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-rose-600">تولید گزارش ناموفق بود. دوباره تلاش کنید.</p>
            <Button
              variant="outline"
              onClick={() => mutation.mutate()}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <RefreshCw className="size-4" aria-hidden />
              تلاش مجدد
            </Button>
          </div>
        ) : null}

        {report ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={copyReport}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {copied ? (
                  <>
                    <ClipboardCheck className="size-4" aria-hidden />
                    کپی شد
                  </>
                ) : (
                  <>
                    <Copy className="size-4" aria-hidden />
                    کپی گزارش
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <ReactMarkdown components={markdownComponents}>{report}</ReactMarkdown>
            </div>
            <div className="flex justify-start">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="text-slate-500 hover:text-emerald-700"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                تولید مجدد
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
