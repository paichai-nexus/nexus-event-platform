import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { z } from "zod";

const partSchema = z.union([z.literal("1"), z.literal("2")]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const parsed = partSchema.safeParse(requestUrl.searchParams.get("part"));
  if (!parsed.success) return NextResponse.json({ ok: false, error: { message: "1부 또는 2부를 선택해주세요." } }, { status: 400 });
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const url = new URL(`/attendance/part-${parsed.data}`, host ? `${protocol}://${host}` : requestUrl.origin).toString();
  const qrCode = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 720, color: { dark: "#07111d", light: "#ffffff" } });
  return NextResponse.json({ ok: true, data: { part: Number(parsed.data), url, qrCode } }, { headers: { "Cache-Control": "no-store" } });
}
