// 배포에서 MSW를 끄면 과거에 등록된 목업 Service Worker가 남아 요청을 가로챌 수 있다.
// 같은 origin의 등록 중 script가 mockServiceWorker.js인 것만 해제한다 — 다른 앱의 Worker는 건드리지 않는다.
export async function unregisterMockServiceWorker(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
        registrations
            .filter((registration) =>
                [registration.active, registration.waiting, registration.installing].some(
                    (worker) => worker?.scriptURL.endsWith('/mockServiceWorker.js'),
                ),
            )
            .map((registration) => registration.unregister()),
    );
}
