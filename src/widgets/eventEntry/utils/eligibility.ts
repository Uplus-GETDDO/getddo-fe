import type { EntryEligibility } from '@entities/entry';
import type { MembershipRule } from '@entities/event';

import { MEMBERSHIP_LABEL } from '@entities/event';

/** 자격 조회(E07)의 불가 사유를 화면이 쓰는 세 갈래로 묶은 결과 */
export interface EntryEligibilityVerdict {
    /**
     * 버튼에 적을 막힌 이유 — 자격 부재일 때만 채운다.
     *
     * 세 사유를 'forbidden' 하나로 뭉쳐 두면 버튼이 전부 '응모할 수 없어요'가 되어,
     * 등급이 모자란 건지 계정이 문제인지 알 수 없었다. 사유마다 다른 말을 적는다.
     */
    forbiddenLabel: string | null;
    /** 서버가 '끝난 응모'로 판정했다 — 자격 부족·장수 부족과 구분해 '응모 완료'로 적는다 */
    completed: boolean;
    /** 장수로 해소되지 않는 자격 부재 — 눌러도 소용없으니 버튼을 잠근다 */
    forbidden: boolean;
    /** 자격은 되지만 장수가 모자라다 — 클릭은 열어 두고 부족 안내로 보낸다 */
    lacking: boolean;
}

/**
 * 응모 자격 판정을 세 갈래로 읽는다 (E07 reasons).
 *
 * 사유를 세 갈래로 나누는 기준은 '사용자가 무엇을 할 수 있는가'다. 끝난 응모는 더 할 게 없고,
 * 자격 부재는 응모권을 모아도 풀리지 않고, 장수 부족만 적립으로 풀린다.
 * 자격 응답이 아직 없으면 세 갈래 모두 false다 — 쓰는 쪽이 이벤트 값으로 근사한다.
 */
export function readEligibility(
    eligibility: EntryEligibility | undefined,
    /** 등급 미달일 때 '어느 등급부터인지'를 적는 데 쓴다 — 없으면 등급 없이 안내한다 */
    membershipRule?: MembershipRule,
): EntryEligibilityVerdict {
    const has = (...reasons: EntryEligibility['reasons']) =>
        reasons.some((reason) => eligibility?.reasons.includes(reason) === true);

    const forbidden = has('ADMIN_ENTRY_FORBIDDEN', 'ENTRY_MEMBERSHIP_NOT_MET', 'EVENT_NOT_OPEN');

    return {
        completed: has('ALREADY_ENTERED', 'TICKET_LIMIT_EXCEEDED'),
        forbidden,
        forbiddenLabel: forbidden ? forbiddenLabelOf(eligibility, membershipRule) : null,
        lacking: has('BRONZE_REQUIRED', 'INSUFFICIENT_TICKETS'),
    };
}

/** 사유가 여럿이면 사용자가 손쓸 수 있는 쪽을 먼저 적는다 — 등급은 올릴 수 있고, 관리자 계정은 아니다 */
function forbiddenLabelOf(
    eligibility: EntryEligibility | undefined,
    membershipRule: MembershipRule | undefined,
): string {
    const reasons = eligibility?.reasons ?? [];
    if (reasons.includes('ENTRY_MEMBERSHIP_NOT_MET')) {
        return membershipRule
            ? `${MEMBERSHIP_LABEL[membershipRule]} 등급부터 응모할 수 있어요`
            : '응모 가능한 멤버십 등급이 아니에요';
    }
    if (reasons.includes('ADMIN_ENTRY_FORBIDDEN')) return '관리자 계정은 응모할 수 없어요';
    if (reasons.includes('EVENT_NOT_OPEN')) return '지금은 응모할 수 없어요';
    return '응모할 수 없어요';
}
