import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { env } from '@shared/config/env';

import { App } from './App';
import { installChunkReload } from './config/chunkReload';
import { unregisterMockServiceWorker } from './config/serviceWorkerCleanup';
import './config/sessionSync';
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

function renderApp() {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App />
            {/* Vercel Speed Insights — 실사용자 Web Vitals 수집 (GD-342).
                대시보드에서 Speed Insights를 활성화해야 데이터가 쌓인다. */}
            <SpeedInsights />
        </StrictMode>,
    );
}

// MSW는 서비스워커 등록이 끝난 뒤 렌더링해야 첫 API 호출도 가로챌 수 있다.
// 목업을 쓰지 않는 빌드(배포)에서는 과거 목업 Worker 해제가 첫 페인트를 막지 않게 렌더링과 병렬로 둔다 (GD-342).
if (env.enableMsw) {
    void import('@mocks/browser')
        .then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }))
        .then(renderApp)
        .catch((error: unknown) => {
            console.error('앱 초기화 실패:', error);
        });
} else {
    renderApp();
    void unregisterMockServiceWorker().catch((error: unknown) => {
        console.warn('목업 서비스워커 해제 실패:', error);
    });
}
