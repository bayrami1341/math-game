import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { DashboardProviders } from "@/components/dashboard/providers";

export const metadata: Metadata = {
  title: "داشبورد معلم — کارگاه ضرب",
  description:
    "داشبورد تحلیلی معلم برای پیگیری یادگیری ضرب دانش‌آموزان بر پایهٔ مدل ۹ لایهٔ عمق، گلوگاه‌های یادگیری و جلسات زندهٔ بازی کارگاه ضرب.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- فونت با <link> بارگذاری می‌شود تا در نبود شبکه صفحه نشکند */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <DashboardProviders>{children}</DashboardProviders>
        <Toaster />
      </body>
    </html>
  );
}
