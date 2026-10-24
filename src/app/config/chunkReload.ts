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
    storage = window.sessionStorage,
    reload = () => window.location.reload(),
    now = () => Date.now(),
}: ChunkReloadDeps = {}): void {
    target.addEventListener('vite:preloadError', (event) => {
        let last = 0;
        try {
            last = Number(storage.getItem(LAST_RELOAD_KEY) ?? 0);
        } catch {
            // 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 기록 없이 한 번 새로고침한다
        }
        if (now() - last < RELOAD_COOLDOWN_MS) return;
        // 기본 동작(오류를 던져 오류 화면을 띄움)을 막고 새 빌드로 다시 연다
        event.preventDefault();
        try {
            storage.setItem(LAST_RELOAD_KEY, String(now()));
        } catch {
            // 기록을 못 남겨도 새로고침은 한다
        }
        reload();
    });
}
