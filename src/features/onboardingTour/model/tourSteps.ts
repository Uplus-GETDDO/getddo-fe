import type { DriveStep } from 'driver.js';

import { TOUR_TARGET, tourSelector } from '@shared/config/tourTargets';

/**
 * 홈 첫 방문 안내 — 응모하는 두 방법(겟또타임·이벤트) → 응모권 모으기 → 결과 알림 → 결과 확인을 5단계로 짚는다.
 * 겟또타임 다음에 바로 이벤트를 짚어 응모권을 쓰는지로 둘을 대비한다. 화면 순서(겟또타임 → 응모권 → 이벤트)와
 * 달라 한 번 내려갔다 올라오지만, 차이를 먼저 알아야 응모권을 왜 모으는지 이어진다.
 * 홈 섹션은 일부만 보여 주므로 단계마다 전체를 볼 수 있는 메뉴 이름을 적는다 — 모바일은 메뉴가 접혀 있어 메뉴를 직접 짚지 않는다
 */
export const TOUR_STEPS: DriveStep[] = [
    {
        element: tourSelector(TOUR_TARGET.getddoTime),
        popover: {
            title: '겟또타임 — 응모권으로 응모해요',
            description:
                "정해진 시간에만 열리는 래플이에요. 홈에서는 지금 열린 회차와 곧 열릴 회차를, 메뉴의 '겟또타임'에서는 전체를 볼 수 있어요.",
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: tourSelector(TOUR_TARGET.events),
        popover: {
            title: '이벤트 — 응모권 없이 응모해요',
            description:
                "응모권을 쓰지 않고 버튼 한 번으로 참여해요. 메뉴의 '이벤트'에서 전체를 볼 수 있어요.",
            side: 'top',
            align: 'start',
        },
    },
    {
        element: tourSelector(TOUR_TARGET.earnTickets),
        popover: {
            title: '응모권은 매일 모아요',
            description:
                "출석·게임·미션으로 받아요. 메뉴의 '미션·게임'에서 한 번에 모을 수 있어요.",
            side: 'top',
            align: 'start',
        },
    },
    {
        element: tourSelector(TOUR_TARGET.notifications),
        popover: {
            title: '결과는 알림으로 알려 드려요',
            description: '추첨이 끝나면 당첨 여부를 이곳에서 바로 확인할 수 있어요.',
            side: 'bottom',
            align: 'end',
        },
    },
    {
        element: tourSelector(TOUR_TARGET.myResults),
        popover: {
            title: '내 응모 결과',
            description: '응모한 이벤트의 발표 대기와 결과를 한곳에서 모아 봐요.',
            side: 'top',
            align: 'start',
        },
    },
];
