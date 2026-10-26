// 배포가 새로 나가면 이전 빌드의 화면 조각(lazy 청크) 파일이 사라진다. 이미 열려 있던 탭이 다른 화면으로 옮기면
// 옛 파일을 받으려다 실패해 오류 화면이 떴다 — Vite가 알려 주는 조각 로딩 실패에서 한 번 새로고침해 새 빌드를 받는다.
// 새로고침 뒤에도 바로 또 실패하면(진짜 네트워크 장애 등) 무한 새로고침이 되지 않게 잠깐은 오류 화면을 그대로 둔다.
const LAST_RELOAD_KEY = 'getddo:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

interface ChunkReloadDeps {
    target?: Pick<Window, 'addEventListener'>;
    storage?: Pick<Storage, 'getItem' | 'setItem'>;
    reload?: () => void;
    now?: () => number;
}

export function installChunkReload({
    target = window,
    storage,
    reload = () => window.location.reload(),
    now = () => Date.now(),
}: ChunkReloadDeps = {}): void {
    target.addEventListener('vite:preloadError', (event) => {
        // 저장소는 실패가 났을 때 try 안에서 꺼낸다 — 사이트 데이터가 막힌 브라우저는 window.sessionStorage를
        // 읽기만 해도 던져, 시작할 때 꺼내 두면 앱이 뜨기 전에 멈췄다.
        // 새로고침 시각을 남길 수 없으면 새로고침하지 않고 오류 화면을 둔다 — 시각 없이 새로고침하면
        // 실패가 이어질 때 쉬는 시간 없이 계속 새로고침된다
        try {
            const store = storage ?? window.sessionStorage;
            const last = Number(store.getItem(LAST_RELOAD_KEY) ?? 0);
            if (now() - last < RELOAD_COOLDOWN_MS) return;
            store.setItem(LAST_RELOAD_KEY, String(now()));
        } catch {
            return;
        }
        // 기본 동작(오류를 던져 오류 화면을 띄움)을 막고 새 빌드로 다시 연다
        event.preventDefault();
        reload();
    });
}
