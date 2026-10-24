import { useAdminEventStatusCounts } from '@entities/event';

const WAITING_STATUSES = ['DRAW_CONFIRMED'] as const;

export interface AdminNavBadge {
    count: number;
    /** 화면 낭독기·툴팁에 읽힐 뜻 — 숫자만으로는 무엇을 기다리는지 모른다 */
    label: string;
}

/**
 * 메뉴 옆 '손이 가야 하는 일' 숫자 — 들어가 보지 않아도 어디부터 볼지 알 수 있게 한다.
 * 지금은 추첨 결과가 확정돼 공개를 기다리는 이벤트만 센다(대시보드와 같은 상태별 건수 조회라 캐시를 나눠 쓴다).
 * 0건이면 배지를 띄우지 않는다
 */
export function useAdminNavBadges(): Record<string, AdminNavBadge | undefined> {
    const { counts } = useAdminEventStatusCounts(WAITING_STATUSES);
    const publishWaiting = counts[0] ?? 0;
    return {
        '/admin/draw':
            publishWaiting > 0
                ? { count: publishWaiting, label: `당첨자 공개 대기 ${publishWaiting}건` }
                : undefined,
    };
}
