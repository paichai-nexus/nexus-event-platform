export const AUDIENCE_SESSION_COOKIE = "audience_attendance_session";

export function readAudienceSessionToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const encoded = cookieHeader
    .split(";")
    .map((item) => item.trim().split("="))
    .find(([name]) => name === AUDIENCE_SESSION_COOKIE)?.[1];
  return encoded ? decodeURIComponent(encoded) : null;
}
