export const AUDIENCE_JURY_AUTH_COOKIE = "audience_jury_auth_session";

export function readAudienceJuryAuthToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const encoded = cookieHeader
    .split(";")
    .map((item) => item.trim().split("="))
    .find(([name]) => name === AUDIENCE_JURY_AUTH_COOKIE)?.[1];
  return encoded ? decodeURIComponent(encoded) : null;
}
