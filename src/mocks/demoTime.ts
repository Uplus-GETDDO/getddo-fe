/*
 * 시연 목업의 상대 시각 유틸.
 *
 * 날짜 리터럴('2026-10-20T05:32:00Z')로 박아 두면 시간이 지나면서
 * "진행 중·예정·최근" fixture가 전부 과거로 굳어 시연이 깨진다 (GD-342).
 * 기준 시각에서 offset만큼 떨어진 시각으로 표현해 이 상수들이 영구히 유효하게 한다.
 */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const DEMO_EPOCH_KEY = 'getddo-mock-demo-epoch';

/**
 * 시연 창의 길이 — 기준 시각에서 이만큼 지나면 응모할 수 있는 래플이 하나도 남지 않는다.
 * 홈 배너 창(기준 +60분)과 같은 값이어야 한다.
 */
export const DEMO_WINDOW_MS = 60 * MINUTE;

/**
 * 시연 기준 시각.
 *
 * Date.now() + n으로 매번 계산하면 페이지를 새로 열 때마다 마감이 그만큼 뒤로 밀려서
 * 카운트다운이 리셋된다 — docs/CONTEXT.md가 금지하는 동작이다. 그래서 세션에 저장해 고정한다.
 *
 * 다만 지난 값을 무조건 재사용하면, 탭을 한참 열어 둔 뒤 돌아왔을 때 모든 창이 과거로
 * 넘어가 응모할 래플이 하나도 없게 된다. 창이 전부 끝난 경우에만 기준을 다시 잡는다 —
 * 진행 중인 창은 그대로 두므로 새로고침으로 카운트다운이 밀리지는 않는다.
 *
 * 앵커를 따로따로 저장하지 않고 이 한 값에서 파생시킨다. 개별 저장은 그중 일부만
 * 다시 잡혔을 때 시작이 마감보다 늦는 창을 만든다.
 *
 * 기준을 다시 잡을지는 가상 시계가 아니라 실제로 흐른 시간으로 판단한다.
 * 앞당긴 시각으로 저장해 버리면 실제 시각으로 돌아왔을 때 모든 창이 미래가 되어
 * 래플이 전부 '오픈 예정'이 된다. 가상 시계는 이 창 위를 지나가는 역할만 한다 —
 * 시각을 앞으로 옮기면 마감·발표로 넘어가고, 창 자체는 그대로 남는다.
 */
function demoEpoch(): number {
    const now = Date.now();

    try {
        const saved = sessionStorage.getItem(DEMO_EPOCH_KEY);
        if (saved) {
            const at = new Date(saved).getTime();
            if (!Number.isNaN(at) && now < at + DEMO_WINDOW_MS) return at;
        }
    } catch {
        // 저장소를 쓸 수 없는 환경(테스트 등)에서는 매번 현재 시각을 쓴다
    }

    try {
        sessionStorage.setItem(DEMO_EPOCH_KEY, new Date(now).toISOString());
    } catch {
        // 저장에 실패해도 이번 로드 동안은 같은 값을 쓴다
    }
    return now;
}

const DEMO_EPOCH = demoEpoch();

/** 시연 기준 시각에서 offsetMs 만큼 떨어진 시각 */
export function demoTime(offsetMs: number): string {
    return new Date(DEMO_EPOCH + offsetMs).toISOString();
}

/**
 * 세션에 고정된 상대 시각 — 관리자 목업(adminEvent.ts)이 등록·중단·취소 시각에 쓴다.
 *
 * 키마다 따로 저장하지 않고 기준 시각에서 파생시킨다. 개별 저장은 창이 지난 뒤에도
 * 과거 값을 그대로 돌려줘서, 탭을 오래 열어 두면 되살아나지 않는다.
 * key는 호출부에서 어떤 시각인지 읽히도록 남겨 둔다.
 */
export function sessionFixedTime(key: string, offsetMs: number): string {
    void key;
    return demoTime(offsetMs);
}
