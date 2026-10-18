"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Rocket,
  Download,
  ExternalLink,
  FlaskConical,
  Bug,
  CheckCircle2,
  Sparkles,
  Gamepad2,
  ShieldCheck,
  Layers,
} from "lucide-react";

const fixes = [
  {
    icon: <Bug className="h-5 w-5" />,
    title: "شکاف ۱ — اکشن شروع مأموریت جانبی وصل شد",
    body: "دکمه‌های «تعمیر آنتن فرعی»، «شارژ سلول پشتیبان» و «تأمین سوخت اضافه» در ورق پایین نقشه نمایش داده می‌شوند و با کلیک، جلسهٔ واقعی شروع می‌شود (bridge → sheet → app → session).",
    files: ["bridge.js", "station/index.js", "station/sheet.js", "v10.html", "app.js"],
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "شکاف ۲ — تولید ۵ سؤال تطبیقی اختصاصی هر مأموریت",
    body: "تابع Pure جدید generateSideMissionQuestions در هستهٔ الگوریتمی: ۵ سؤال از فاکتورهای خود مأموریت، با استراتژی برگرفته از گلوگاه‌های شناختی سکتور مادر و seed تطبیقی برای تنوع بین تلاش‌ها.",
    files: ["experience.mjs", "styles/v10.css"],
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "محافظت از لیدربرد و سلول‌های اصلی",
    body: "رکورد مأموریت جانبی با type=side ذخیره می‌شود ولی درصد سکتور و تابلو نتایج کلاس را هرگز تغییر نمی‌دهد (affectsLeaderboard: false رعایت شد).",
    files: ["bridge.js", "experience.mjs"],
  },
];

const testGroups = [
  { name: "رگرسیون لایهٔ ایستگاه (v10)", count: 10 },
  { name: "مدل عمق و گلوگاه‌ها (v10.1)", count: 10 },
  { name: "مأموریت‌های جانبی + رگرسیون activityId — جدید", count: 11 },
];

export default function Home() {
  const [showGame, setShowGame] = useState(false);

  return (
    <div
      dir="rtl"
      lang="fa"
      className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-teal-950 text-slate-100"
    >
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-teal-300">
            <Rocket className="h-5 w-5" />
            <span>کارگاه ضرب — نسخهٔ ۱۰.۱</span>
          </div>
          <Badge variant="outline" className="border-teal-400/40 text-teal-300">
            v10.1.1 — اصلاح‌شده
          </Badge>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-4 py-6">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-relaxed">
            بستهٔ ۱۰.۱ شما،{" "}
            <span className="text-teal-300">بازبینی، ممیزی و تکمیل</span> شد
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto leading-8 text-sm sm:text-base">
            هر دو شکاف شناسایی‌شده بین سند راهنما و کد، به‌همراه دو باگ P0 که فقط در اجرای واقعی مرورگر خود را نشان می‌دادند، اصلاح و با ۱۱ آزمون جدید پوشش داده شد.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
              onClick={() => setShowGame((v) => !v)}
            >
              <Gamepad2 className="h-5 w-5 ml-1" />
              {showGame ? "بستن پیش‌نمایش بازی" : "اجرای بازی همین‌جا"}
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" asChild>
              <a href="/math-game/v10.html" target="_blank" rel="noreferrer">
                <ExternalLink className="h-5 w-5 ml-1" />
                بازی در تب جدید
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" asChild>
              <a href="/math-game-v10.1-fixed.zip" download>
                <Download className="h-5 w-5 ml-1" />
                دانلود بستهٔ کامل (با آزمون‌ها)
              </a>
            </Button>
          </div>
          <p className="text-xs text-slate-400 pt-1">
            در بازی، از «ورود مستقیم به ایستگاه (آفلاین / محلی)» استفاده کنید؛
            ورود آنلاین به سرویس Firebase شبکه نیاز دارد.
          </p>
        </section>

        {/* Embedded game preview */}
        {showGame && (
          <section className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <iframe
              src="/math-game/v10.html"
              title="کارگاه ضرب — نسخهٔ ۱۰.۱"
              className="w-full h-[640px] bg-[#071427]"
            />
          </section>
        )}

        {/* Test evidence */}
        <Card className="bg-slate-900/70 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-300">
              <FlaskConical className="h-5 w-5" />
              راستی‌آزمایی — ۳۱/۳۱ آزمون پاس شد
            </CardTitle>
            <CardDescription className="text-slate-400">
              اجرای واقعی <code className="text-teal-300">npm test</code> روی
              بستهٔ اصلاح‌شده (node --test)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {testGroups.map((g) => (
              <div
                key={g.name}
                className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {g.name}
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {g.count} پاس
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Fixes */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Bug className="h-5 w-5 text-amber-400" />
            چه چیزی اصلاح شد؟
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {fixes.map((f) => (
              <Card key={f.title} className="bg-slate-900/70 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-7 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5 shrink-0">{f.icon}</span>
                    {f.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-300 leading-7">{f.body}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.files.map((file) => (
                      <Badge
                        key={file}
                        variant="secondary"
                        className="bg-slate-800 text-slate-300 text-[11px] font-mono"
                        dir="ltr"
                      >
                        {file}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Depth model showcase */}
        <Card className="bg-slate-900/70 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-300">
              <Layers className="h-5 w-5" />
              مدل ۹ لایهٔ عمق + ۳ مأموریت جانبی — دست‌نخورده و محافظت‌شده
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10">
                    <th className="py-2 px-3 font-medium">بنا</th>
                    <th className="py-2 px-3 font-medium">فاکتورها</th>
                    <th className="py-2 px-3 font-medium">لایه‌ها</th>
                    <th className="py-2 px-3 font-medium">مأموریت جانبی (۷۰٪)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { b: "⚡ نیروگاه", f: "۲× تا ۵×", d: "۸ / ۱۰ / ۶ سؤال", s: "📡 تعمیر آنتن فرعی" },
                    { b: "📡 برج ارتباط", f: "۶× تا ۹×", d: "۸ / ۱۰ / ۶ سؤال", s: "🔋 شارژ سلول پشتیبان" },
                    { b: "🚀 سکوی پرتاب", f: "۱۰× تا ۱۲×", d: "۸ / ۱۰ / ۶ سؤال", s: "🚀 تأمین سوخت اضافه" },
                  ].map((r) => (
                    <tr key={r.b} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 px-3">{r.b}</td>
                      <td className="py-2.5 px-3 text-slate-300">{r.f}</td>
                      <td className="py-2.5 px-3 text-slate-300">{r.d}</td>
                      <td className="py-2.5 px-3 text-teal-300">{r.s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Separator className="bg-white/10" />

        <section className="text-center text-sm text-slate-400 space-y-2 pb-2">
          <p>
            بستهٔ کامل اصلاح‌شده (شامل سند راهنما، کد و ۳۰ آزمون) در فایل زیپ
            بالا آمادهٔ بارگذاری در گیت‌هاب یا هر محیط توسعهٔ دیگر است.
          </p>
        </section>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-white/10 bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>کارگاه ضرب — ایستگاه یادگیری ۱۰.۱ | نسخهٔ اصلاح‌شده v10.1.1</span>
          <span dir="ltr" className="font-mono">
            31/31 tests passing · node --test
          </span>
        </div>
      </footer>
    </div>
  );
}
