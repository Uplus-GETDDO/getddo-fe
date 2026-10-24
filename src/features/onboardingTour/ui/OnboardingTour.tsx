import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useEffect } from 'react';

import { useSessionStore } from '@entities/user';

import '../assets/tour.css';
import { TOUR_STEPS } from '../model/tourSteps';
import { hasSeenTour, markTourSeen } from '../utils/tourSeen';

/** 화면이 자리 잡을 틈 — 카드가 불러와지며 높이가 바뀌는 중에 짚으면 밝힌 자리가 엇나간다 */
const START_DELAY_MS = 800;

/**
 * 홈 첫 방문 안내 — 가상 사용자마다 처음 한 번만 4단계 말풍선으로 화면을 짚는다 (driver.js).
 * 시작하는 순간 본 것으로 적는다 — 중간에 닫거나 다른 화면으로 가도 다시 뜨지 않는다.
 * 그리는 것은 driver.js가 body에 직접 붙이므로 이 컴포넌트는 아무것도 렌더하지 않는다.
 * ready: 홈 목록이 도착해 짚을 자리가 화면에 다 그려졌는지
 */
export function OnboardingTour({ ready }: { ready: boolean }) {
    const userId = useSessionStore((state) => state.user?.id);

    useEffect(() => {
        if (!ready || !userId || hasSeenTour(userId)) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const tour = driver({
            steps: TOUR_STEPS,
            popoverClass: 'getddo-tour',
            showProgress: true,
            progressText: '{{current}} / {{total}}',
            nextBtnText: '다음',
            prevBtnText: '이전',
            doneBtnText: '시작하기',
            closeBtnLabel: '안내 닫기',
            // 바탕 어둡게는 다른 모달과 같은 막 토큰 — 토큰에 투명도가 들어 있어 따로 겹치지 않는다
            overlayColor: 'var(--color-surface-overlay)',
            overlayOpacity: 1,
            stagePadding: 8,
            stageRadius: 16,
            // 안내 중 밝힌 자리를 눌러 다른 화면으로 가지 않게 — 끝까지 보거나 닫은 뒤에 쓴다
            disableActiveInteraction: true,
            // 자리가 없으면(조회 실패로 섹션이 빠진 경우 등) 그 단계만 건너뛴다
            skipMissingElement: true,
            animate: !reduceMotion,
            smoothScroll: !reduceMotion,
        });
        const timer = window.setTimeout(() => {
            markTourSeen(userId);
            tour.drive();
        }, START_DELAY_MS);
        return () => {
            window.clearTimeout(timer);
            tour.destroy();
        };
    }, [ready, userId]);

    return null;
}
