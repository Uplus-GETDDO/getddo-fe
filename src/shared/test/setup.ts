import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * findBy·waitFor의 기본 대기는 1초다. 관리자 라우트는 lazy로 쪼개져 있어 전체 병렬 실행에서
 * 작업자들이 CPU를 나눠 쓰면 청크 로딩만으로 1초를 넘긴다 — 멀쩡한 테스트가 무작위로 빨갛게
 * 떴다 재실행하면 통과했다. 기다리는 시간을 늘려도 통과하는 테스트의 속도는 그대로다.
 */
configure({ asyncUtilTimeout: 5_000 });

// jsdom에는 ResizeObserver가 없다 — Radix(radio-group 등)가 크기를 재는 훅에서 쓰므로 스텁으로 둔다
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

// jsdom의 window.scrollTo는 "not implemented" 오류를 로깅하는 스텁이다 —
// ScrollRestoration이 라우트 전환마다 호출하므로 테스트에서 noop으로 덮어 로그 오염을 막는다
if (typeof window !== 'undefined') {
    window.scrollTo = () => {};
}

// MSW 수명주기는 src/mocks/testSetup.ts가 담당한다 — shared가 mocks를 참조하면
// FSD 의존 방향(하위→상위)을 거꾸로 타기 때문에 둘을 분리했다
afterEach(() => {
    cleanup();
});
