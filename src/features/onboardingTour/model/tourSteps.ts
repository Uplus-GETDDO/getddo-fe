import type { DriveStep } from 'driver.js';

import { TOUR_TARGET, tourSelector } from '@shared/config/tourTargets';

/**
 * 홈 첫 방문 안내 — 화면 위에서 아래 순서로, 서비스 한 바퀴(응모권으로 응모 → 응모권 모으기 → 결과 알림 → 결과 확인)를 4단계로 짚는다.
 * 말은 한 단계에 한 가지만 — 제목은 무엇인지, 설명은 무엇을 하면 되는지
 */
export const TOUR_STEPS: DriveStep[] = [
    {
        element: tourSelector(TOUR_TARGET.getddoTime),
        popover: {
            title: '겟또타임에 응모해요',
            description: '정해진 시간에만 열리는 래플이에요. 모은 응모권을 써서 경품에 응모해요.',
            side: 'bottom',
            align: 'start',
        },
    },
    {
        element: tourSelector(TOUR_TARGET.earnTickets),
        popover: {
            title: '응모권은 여기서 모아요',
            description: '출석, 미션, 게임으로 매일 응모권을 받을 수 있어요.',
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
