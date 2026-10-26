import { env } from '@shared/config/env';

// 데이터 출처 — 앱을 열 때 한 번 정하고 그 방문 동안 바꾸지 않는다.
// 서버가 살아 있으면 실서버, 닿지 않으면(5xx·연결 실패·시간 초과) 목업으로 시작한다. 한 방문 안에서 실데이터와
// 목업이 섞이면 지금 보는 값이 진짜인지 알 수 없어, 도중에 서버 상태가 바뀌어도 새로고침 전까지는 그대로 둔다.
// 주소에 ?demo=1 / ?demo=0을 붙이면 이 탭은 확인 없이 목업 / 실서버로 고정한다 (확인·디버깅용)
export type DataSource = 'live' | 'mock';

const OVERRIDE_KEY = 'getddo:data-source';
const PROBE_TIMEOUT_MS = 3_000;

let current: DataSource = 'live';

/** 이번 방문의 데이터 출처 — 앱 시작 전에 resolveDataSource가 정한다 */
export function getDataSource(): DataSource {
    return current;
}

/** 서버가 응답하는지 — 4xx는 서버가 살아 있다는 뜻이라 실서버로 본다 */
async function probeServer(): Promise<boolean> {
    try {
        const response = await fetch(`${env.apiBaseUrl}/v1/events?page=1&size=1`, {
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        return response.status < 500;
    } catch {
        return false;
    }
}

interface ResolveDeps {
    /** 로컬 개발처럼 늘 목업을 쓰는 빌드 */
    forceMock?: boolean;
    search?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'>;
    probe?: () => Promise<boolean>;
}

export async function resolveDataSource({
    forceMock = env.enableMsw,
    search = window.location.search,
    storage,
    probe = probeServer,
}: ResolveDeps = {}): Promise<DataSource> {
    current = await decide();
    return current;

    async function decide(): Promise<DataSource> {
        if (forceMock) return 'mock';
        // 저장소는 try 안에서 꺼낸다 — 막힌 브라우저는 sessionStorage를 읽기만 해도 던진다
        const demo = new URLSearchParams(search).get('demo');
        try {
            const store = storage ?? window.sessionStorage;
            if (demo === '1' || demo === '0') {
                const forced = demo === '1' ? 'mock' : 'live';
                store.setItem(OVERRIDE_KEY, forced);
                return forced;
            }
            const saved = store.getItem(OVERRIDE_KEY);
            if (saved === 'mock' || saved === 'live') return saved;
        } catch {
            if (demo === '1') return 'mock';
            if (demo === '0') return 'live';
        }
        return (await probe()) ? 'live' : 'mock';
    }
}
