import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { env } from '@shared/config/env';

import { App } from './App';
import { unregisterMockServiceWorker } from './config/serviceWorkerCleanup';
import './config/sessionSync';

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
