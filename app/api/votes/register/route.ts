import { DomainError, toErrorResponse } from "@/lib/errors/domainError";

export async function POST() {
  return toErrorResponse(new DomainError("FORBIDDEN", "PCU 인증번호와 학적 정보로 청중평가단을 등록해주세요.", 403));
}
