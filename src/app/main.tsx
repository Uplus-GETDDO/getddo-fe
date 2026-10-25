import { installChunkReload } from './config/chunkReload';
import './styles/globals.css';

installChunkReload();

// Pretendard @font-face는 별도 CSS 청크로 나눠 렌더블로킹 경로에서 뺀다 (GD-332).
// 선언이 늦게 도착해도 font-display: swap이 시스템 폰트로 먼저 그리고 바꿔 끼운다.
// 유휴 시점까지 미뤄 폰트 CSS·subset 다운로드가 첫 페인트와 대역을 다투지 않게 한다 (GD-342).
const loadPretendard = () => {
    void import('./styles/pretendard.css').catch((error: unknown) => {
        console.warn('Pretendard 폰트 CSS 로드 실패:', error);
    });
};
if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadPretendard);
} else {
    setTimeout(loadPretendard, 0);
}

// 첫 페인트가 entry JS 평가를 기다리지 않게 앱 부팅을 별도 태스크로 미룬다 (GD-348).
// 모듈 평가가 끝나면 렌더링 단계에서 index.html의 정적 로그인 셸이 먼저 그려지고,
// 다음 태스크에서 부팅 청크가 로드·실행된다 — react·router·zod 같은 무거운 그래프는
// 부팅 청크의 동적 그래프로 이동해 index.html의 modulepreload 대상에서 빠진다.
setTimeout(() => {
    void import('./bootstrap').catch((error: unknown) => {
        console.error('앱 부팅 실패:', error);
    });
}, 0);
