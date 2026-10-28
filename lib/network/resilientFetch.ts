export type RequestFailureKind = "HTTP" | "NETWORK" | "TIMEOUT" | "ABORTED";

export class RequestFailure extends Error {
  constructor(
    message: string,
    readonly kind: RequestFailureKind,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RequestFailure";
  }
}

type ErrorPayload = { error?: { code?: string; message?: string } };

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8_000,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null) as (T & ErrorPayload) | null;
    if (!response.ok) {
      throw new RequestFailure(
        payload?.error?.message ?? `요청이 실패했습니다. (${response.status})`,
        "HTTP",
        response.status,
        payload?.error?.code,
      );
    }
    if (payload === null) throw new RequestFailure("서버 응답을 확인하지 못했습니다.", "NETWORK");
    return payload;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    if (controller.signal.aborted) {
      throw new RequestFailure(
        timedOut ? "서버 응답 시간이 초과되었습니다." : "요청이 취소되었습니다.",
        timedOut ? "TIMEOUT" : "ABORTED",
      );
    }
    throw new RequestFailure(error instanceof Error ? error.message : "네트워크 연결을 확인해주세요.", "NETWORK");
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function isAmbiguousMutationFailure(error: unknown) {
  if (!(error instanceof RequestFailure)) return false;
  return error.kind === "NETWORK"
    || error.kind === "TIMEOUT"
    || error.status === 408
    || error.status === 429
    || Boolean(error.status && error.status >= 500);
}

export function backoffDelay(attempt: number, baseMs = 300, maxMs = 3_000, random = Math.random) {
  const exponential = Math.min(maxMs, baseMs * (2 ** Math.max(0, attempt)));
  return Math.min(maxMs, Math.round(exponential * (0.75 + random() * 0.5)));
}

export async function retryRead<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    baseMs?: number;
    maxMs?: number;
    random?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
) {
  const attempts = options.attempts ?? 3;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || options.shouldRetry?.(error) === false) break;
      await sleep(backoffDelay(attempt, options.baseMs, options.maxMs, options.random));
    }
  }
  throw lastError;
}
