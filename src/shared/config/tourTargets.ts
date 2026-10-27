/**
 * 첫 방문 안내(features/onboardingTour)가 짚는 화면 자리.
 * 위젯·레이아웃은 data-tour에 이 값을 달고, 안내는 같은 값으로 찾는다 — 안내가 위젯을 직접 참조하지 않게 이름만 공유한다
 */
export const TOUR_TARGET = {
    getddoTime: 'getddo-time',
    events: 'events',
    earnTickets: 'earn-tickets',
    notifications: 'notifications',
    myResults: 'my-results',
} as const;

export type TourTarget = (typeof TOUR_TARGET)[keyof typeof TOUR_TARGET];

export const tourSelector = (target: TourTarget) => `[data-tour="${target}"]`;
