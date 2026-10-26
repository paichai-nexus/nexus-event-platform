import QRCode from "qrcode";
import { authorizeRoles } from "@/lib/auth/authorize";
import { createAttendanceExitPass } from "@/lib/attendance/exitPass";
import { toErrorResponse } from "@/lib/errors/domainError";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const { token, expiresAt } = createAttendanceExitPass();
    const requestUrl = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
    const exitUrl = new URL("/check-in", host ? `${protocol}://${host}` : requestUrl.origin);
    exitUrl.searchParams.set("exitPass", token);
    const qrCode = await QRCode.toDataURL(exitUrl.toString(), {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#07111d", light: "#ffffff" },
    });

    return Response.json(
      { ok: true, data: { qrCode, exitUrl: exitUrl.toString(), expiresAt } },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
