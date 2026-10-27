import QRCode from "qrcode";
import { authorizeRoles } from "@/lib/auth/authorize";
import { createAttendanceEntryPass } from "@/lib/attendance/exitPass";
import { toErrorResponse } from "@/lib/errors/domainError";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const requestUrl = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
    const entryUrl = new URL("/api/attendance/enter", host ? `${protocol}://${host}` : requestUrl.origin);
    const { token, expiresAt } = createAttendanceEntryPass();
    entryUrl.searchParams.set("entryPass", token);
    const qrCode = await QRCode.toDataURL(entryUrl.toString(), {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#07111d", light: "#ffffff" },
    });

    return Response.json(
      { ok: true, data: { qrCode, entryUrl: entryUrl.toString(), expiresAt } },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
