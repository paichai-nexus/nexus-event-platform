import type { Metadata, Viewport } from "next";
import { EventOpsProvider } from "@/features/event/context/EventOpsProvider";
import { runtimeDisplayState } from "@/lib/config/runtime";
import "./globals.css";
import "./operations.css";

export const metadata: Metadata = {
  title: "제24회 배재대학교 경영대학 학술제",
  description:
    "2026 배재대학교 경영대학 학술제 행사 안내, 프로그램, 본선 참가팀 및 청중평가 안내",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const runtime = runtimeDisplayState();
  const providerMode = runtime.valid && runtime.mode !== "unconfigured" ? runtime.mode : "production";
  return (
    <html lang="ko">
      <body>
        <div className={`runtime-mode runtime-mode--${runtime.valid ? runtime.mode : "error"}`} role={runtime.valid ? "status" : "alert"}>
          {runtime.label}
        </div>
        <EventOpsProvider runtimeMode={providerMode}>{children}</EventOpsProvider>
      </body>
    </html>
  );
}
