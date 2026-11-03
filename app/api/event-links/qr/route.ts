import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { EVENT_EXTERNAL_FORMS, type EventExternalFormKey } from "@/features/event/data/externalForms";

const allowedTypes = new Set<EventExternalFormKey>(["audienceJuryReservation", "partOneAttendance"]);

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") as EventExternalFormKey | null;
  if (!type || !allowedTypes.has(type)) {
    return NextResponse.json({ ok: false, error: { message: "지원하지 않는 행사 링크입니다." } }, { status: 400 });
  }

  const form = EVENT_EXTERNAL_FORMS[type];
  const qrCode = await QRCode.toDataURL(form.url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
    color: { dark: "#07111d", light: "#ffffff" },
  });

  return NextResponse.json(
    { ok: true, data: { ...form, qrCode } },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
