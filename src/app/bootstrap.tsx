import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { resolveDataSource } from './config/dataSource';
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

/**
 * 목업 시작(서비스워커 등록)이 실패했을 때의 화면 — React를 띄우지 못한 상태라 DOM으로 직접 그린다.
 * 다시 들르는 사용자는 index.html이 #root를 미리 비우므로, 아무것도 그리지 않으면 빈 화면으로 멈췄다
 */
function renderStartupError() {
    const root = document.getElementById('root');
    if (!root) return;
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.className = 'flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center';
    const title = document.createElement('p');
    title.className = 'text-title-3 text-fg-primary';
    title.textContent = '화면을 준비하지 못했어요';
    const description = document.createElement('p');
    description.className = 'text-body-sm text-fg-tertiary';
    description.textContent = '잠시 후 다시 시도해 주세요.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className =
        'bg-action-neutral text-fg-on-brand hover:bg-action-neutral-hover mt-2 h-10 cursor-pointer rounded-lg px-6 text-base font-semibold';
    retry.textContent = '다시 시도';
    retry.addEventListener('click', () => window.location.reload());
    box.append(title, description, retry);
    root.replaceChildren(box);
}

// 데이터 출처를 먼저 정한다 — 로컬 개발은 늘 목업, 배포는 서버가 닿으면 실서버·안 닿으면 목업 (config/dataSource).
// MSW는 서비스워커 등록이 끝난 뒤 렌더링해야 첫 API 호출도 가로챌 수 있다.
// 실서버로 쓰는 방문에서는 과거 목업 Worker 해제가 첫 페인트를 막지 않게 렌더링과 병렬로 둔다 (GD-342).
void resolveDataSource().then((source) => {
    if (source === 'mock') {
        return import('@mocks/browser')
            .then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }))
            .then(renderApp)
            .catch((error: unknown) => {
                console.error('앱 초기화 실패:', error);
                renderStartupError();
            });
    }
    renderApp();
    void unregisterMockServiceWorker().catch((error: unknown) => {
        console.warn('목업 서비스워커 해제 실패:', error);
    });
});
