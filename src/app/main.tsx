import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { env } from '@shared/config/env';

import { App } from './App';
import { unregisterMockServiceWorker } from './config/serviceWorkerCleanup';
import './config/sessionSync';
import './styles/globals.css';

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
            </StrictMode>,
        );
    })
    .catch((error: unknown) => {
        console.error('앱 초기화 실패:', error);
    });
