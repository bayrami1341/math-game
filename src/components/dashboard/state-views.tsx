"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorCardProps {
  /** متن خطای نمایش‌داده‌شده در کارت */
  message?: string;
  onRetry: () => void;
  className?: string;
}

/** کارت خطای واکشی با دکمهٔ تلاش مجدد */
export function ErrorCard({ message, onRetry, className }: ErrorCardProps) {
  return (
    <Card className={cn("border-rose-200 bg-rose-50/60", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-rose-100">
          <WifiOff className="size-5 text-rose-600" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-rose-700">دریافت داده‌ها ناموفق بود</p>
          <p className="mt-1 text-xs text-rose-600/80">{message ?? "اتصال به سرور برقرار نشد."}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRetry} className="border-rose-300 text-rose-700 hover:bg-rose-100">
          تلاش مجدد
        </Button>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
}

/** حالت خالی ظریف با آیکون تیک سبز */
export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="max-w-sm text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}

/** عنوان بخش داخل کارت‌ها */
export function SectionTitle({ icon, children, className }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("flex items-center gap-2 text-sm font-semibold text-slate-800", className)}>
      {icon}
      {children}
    </h3>
  );
}
