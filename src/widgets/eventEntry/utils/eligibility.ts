import type { EntryEligibility } from '@entities/entry';

/** 자격 조회(E07)의 불가 사유를 화면이 쓰는 세 갈래로 묶은 결과 */
export interface EntryEligibilityVerdict {
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
): EntryEligibilityVerdict {
    const has = (...reasons: EntryEligibility['reasons']) =>
        reasons.some((reason) => eligibility?.reasons.includes(reason) === true);

    return {
        completed: has('ALREADY_ENTERED', 'TICKET_LIMIT_EXCEEDED'),
        forbidden: has('ADMIN_ENTRY_FORBIDDEN', 'ENTRY_MEMBERSHIP_NOT_MET', 'EVENT_NOT_OPEN'),
        lacking: has('BRONZE_REQUIRED', 'INSUFFICIENT_TICKETS'),
    };
}
