import { ApiError } from './client';

/** 오류 문구를 정할 수 없을 때(네트워크·타임아웃·봉투 없는 응답 등) 쓰는 공통 기본 문구 */
export const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * FE 매핑 테이블 (ADR-0008 1단계) — 오류 코드 체계(getddo-spec 05-api/common.md)가 확정되면 행만 추가한다.
 * 값은 코드→문구 데이터일 뿐이고, 화면별 분기는 문구가 아니라 `error.code`로 판단한다.
 */
const ERROR_MESSAGES: Record<string, string> = {
    /*
     * 실서버 현행 번호 코드 (getddo-spec 05-api/common.md "현행 코드" 표기).
     * COMMON-002는 매핑하지 않는다 — 400은 공개 문구 계약이 적용되는 응답이라 서버의
     * 구체 입력 위반 문구(예: '취소 사유는 1~1000자')를 통과시키는 편이 정확하다.
     */
    'COMMON-001': '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    'COMMON-005': '요청 형식이 올바르지 않습니다.',
    'COMMON-006': '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'HTTP-404': '요청한 대상을 찾을 수 없습니다.',
    'USER-002': '사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.',
    'USER-003': '사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.',
    'USER-004': '사용자 정보가 올바르지 않습니다. 다시 로그인해 주세요.',
    'USER-005': '사용자 멤버십 정보가 없습니다. 사용자를 다시 선택해 주세요.',
    'USER-006': '사용자 멤버십 정보가 일치하지 않습니다. 사용자를 다시 선택해 주세요.',
    // E04 응모·M03 미션 계열 번호 코드
    'EVENT-008': '검색 조건을 확인해 주세요.',
    'ENTRY-001': '응모 요청 형식이 올바르지 않습니다.',
    'ENTRY-002': '관리자는 이벤트에 응모할 수 없습니다.',
    'ENTRY-003': '응모 가능한 멤버십 등급이 아닙니다.',
    'ENTRY-004': '이벤트를 찾을 수 없습니다.',
    'ENTRY-005': '지금은 응모할 수 있는 시간이 아닙니다.',
    'ENTRY-006': '이미 응모한 이벤트입니다.',
    'ENTRY-007': '이 이벤트의 응모 한도를 초과했습니다.',
    'ENTRY-008': '이 이벤트는 브론즈 응모권이 필요합니다.',
    'ENTRY-009': '이미 처리 중인 요청과 내용이 다릅니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
    'ENTRY-010': '관리자 권한이 필요합니다.',
    'MISSION-001': '미션 구성이 올바르지 않습니다.',
    'MISSION-002': '답변 형식이 올바르지 않습니다.',
    'MISSION-003': '미션을 찾을 수 없습니다.',
    'MISSION-004': '지금은 참여할 수 있는 미션이 아닙니다.',
    'MISSION-005':
        '이미 처리 중인 요청과 내용이 다릅니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
    'TICKET-006': '보유한 응모권이 부족합니다.',
    /*
     * 제안 이름 코드 — spec에 '제안'으로 남은 값이자 목업 핸들러가 방출하는 코드다.
     * 실서버는 위 번호 코드를 보내므로 같은 의미가 둘로 나뉘어 있다. 제안이 채택되거나
     * 목업이 번호 코드로 갱신되면 정리한다.
     */
    USER_MEMBERSHIP_MISMATCH:
        '사용자 멤버십 정보가 일치하지 않습니다. 사용자를 다시 선택해 주세요.',
    INSUFFICIENT_TICKETS: '보유한 응모권이 부족합니다.',
    TICKET_LIMIT_EXCEEDED: '이 이벤트의 응모 한도를 초과했습니다.',
    ALREADY_ENTERED: '이미 응모한 이벤트입니다.',
    EVENT_NOT_OPEN: '지금은 응모할 수 있는 시간이 아닙니다.',
    MISSION_NOT_OPEN: '지금은 참여할 수 있는 미션이 아닙니다.',
    ENTRY_MEMBERSHIP_NOT_MET: '응모 가능한 멤버십 등급이 아닙니다.',
    RATE_LIMIT_EXCEEDED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    IDEMPOTENCY_CONFLICT:
        '이미 처리 중인 요청과 내용이 다릅니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
    USER_CONTEXT_REQUIRED: '사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.',
    USER_CONTEXT_INVALID: '사용자 정보가 올바르지 않습니다. 다시 로그인해 주세요.',
    ACCESS_DENIED: '이 작업을 수행할 권한이 없습니다.',
};

/** 공개 문구 계약(common.md "오류")이 적용되지 않는 응답 — 서버 message를 화면에 노출하지 않는다 */
function isServerMessageUntrusted(error: ApiError): boolean {
    return error.status >= 500 || error.code === 'COMMON-001' || error.code.startsWith('HTTP-');
}

function formatWait(seconds: number): string {
    if (seconds < 60) return `${seconds}초`;
    return `${Math.ceil(seconds / 60)}분`;
}

/**
 * 코드 문자열만으로 FE 매핑 문구를 찾는다 — 응모 거절 이력의 rejectionCode처럼
 * ApiError가 아닌 저장 데이터에도 같은 매핑을 적용할 때 쓴다. 매핑이 없으면 undefined다
 */
export function getErrorCodeMessage(code: string | null | undefined): string | undefined {
    if (code == null || code === '') return undefined;
    // __proto__ 같은 상속 키가 매핑으로 잡히지 않도록 자체 속성만 본다
    return Object.hasOwn(ERROR_MESSAGES, code) ? ERROR_MESSAGES[code] : undefined;
}

/**
 * 화면에 보일 오류 문구를 ADR-0008 순서로 정한다.
 * 1) FE 매핑(5xx여도 우선) → 2) 서버 message(공개 계약이 적용되는 응답만) → 3) fallback/공통 기본 문구
 */
export function getErrorMessage(error: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
    if (!(error instanceof ApiError)) return fallback;

    const mapped = getErrorCodeMessage(error.code);
    if (mapped) {
        // 429는 실서버가 COMMON-006, 목업이 RATE_LIMIT_EXCEEDED로 보낸다 — 둘 다 대기 시간을 표시한다
        if (
            (error.code === 'COMMON-006' || error.code === 'RATE_LIMIT_EXCEEDED') &&
            error.retryAfterSeconds != null
        ) {
            return `요청이 너무 많습니다. ${formatWait(error.retryAfterSeconds)} 후에 다시 시도해 주세요.`;
        }
        return mapped;
    }

    if (isServerMessageUntrusted(error) || !error.message) return fallback;
    return error.message;
}
