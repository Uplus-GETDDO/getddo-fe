// 응모·추첨처럼 중복 제출이 위험한 요청에 붙이는 멱등키를 생성한다.
// 헤더명은 spec 공통 계약 초안(05-api/common.md)의 `Idempotency-Key`를 따른다 — 초안이라 확정 시 값만 바뀐다.
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export function createIdempotencyKey(): string {
    return crypto.randomUUID();
}
