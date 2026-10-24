import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { env } from '@shared/config/env';

import { App } from './App';
import { unregisterMockServiceWorker } from './config/serviceWorkerCleanup';
import './config/sessionSync';
import './styles/globals.css';

// Pretendard @font-face는 별도 CSS 청크로 나눠 렌더블로킹 경로에서 뺀다 (GD-332).
// 선언이 늦게 도착해도 font-display: swap이 시스템 폰트로 먼저 그리고 바꿔 끼운다.
void import('./styles/pretendard.css').catch((error: unknown) => {
    console.warn('Pretendard 폰트 CSS 로드 실패:', error);
});

// MSW는 서비스워커 등록이 끝난 뒤 렌더링해야 첫 API 호출도 가로챌 수 있다.
// 목업을 쓰지 않는 빌드(배포)에서는 과거에 설치된 목업 Worker를 해제해 요청이 실서버로 간다.
async function prepareRuntime() {
    if (env.enableMsw) {
        const { worker } = await import('@mocks/browser');
        await worker.start({ onUnhandledRequest: 'bypass' });
        return;
    }
    // Worker 해제 실패가 렌더링을 막지 않도록 최선 노력으로만 처리한다.
    await unregisterMockServiceWorker().catch((error: unknown) => {
        console.warn('목업 서비스워커 해제 실패:', error);
    });
}

void prepareRuntime()
    .then(() => {
        createRoot(document.getElementById('root')!).render(
            <StrictMode>
                <App />
                {/* Vercel Speed Insights — 실사용자 Web Vitals 수집 (GD-342).
                    대시보드에서 Speed Insights를 활성화해야 데이터가 쌓인다. */}
                <SpeedInsights />
            </StrictMode>,
        );
    })
    .catch((error: unknown) => {
        console.error('앱 초기화 실패:', error);
    });
