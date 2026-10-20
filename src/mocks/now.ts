import { VIRTUAL_CLOCK_STORAGE_KEY } from '@shared/model/virtualClock/storageKey';

/**
 * 목업이 보는 현재 시각.
 *
 * 관리자 가상 시계로 시간을 옮기면 이벤트 상태도 함께 움직여야 시연에서
 * 마감 → 발표 대기 → 발표 완료를 보여줄 수 있다. 화면만 시간을 따라가고
 * 서버 응답이 멈춰 있으면 흐름이 끊긴다.
 *
 * 저장 키는 shared/model/virtualClock의 Provider가 쓰는 값과 같다.
 * leaf 파일만 참조해 목업이 React Provider까지 끌어오지 않게 한다.
 */
export function mockNow(): Date {
    try {
        const raw = sessionStorage.getItem(VIRTUAL_CLOCK_STORAGE_KEY);
        if (raw) {
            const at = new Date(raw);
            if (!Number.isNaN(at.getTime())) return at;
        }
    } catch {
        // 저장소를 쓸 수 없는 환경(테스트 등)에서는 실제 시각을 쓴다
    }
    return new Date();
}
