export type DomainErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "INVALID_STATE"
  | "EVENT_CLOSED"
  | "VOTING_CLOSED"
  | "NOT_CHECKED_IN"
  | "ALREADY_SUBMITTED"
  | "DATABASE_ERROR";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }

  console.error("Unhandled server error", error);
  return Response.json(
    { ok: false, error: { code: "DATABASE_ERROR", message: "요청을 처리하지 못했습니다." } },
    { status: 500 },
  );
}
