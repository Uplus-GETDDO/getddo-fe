import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            // 중첩 작업트리의 복제 테스트만 제외하고 Vitest 기본 제외 목록은 유지한다.
            exclude: [...configDefaults.exclude, '**/.claude-worktrees/**'],
            environment: 'jsdom',
            // 테스트 하나의 상한 — 기본 5초로는 대기 상한(5초)을 늘린 findBy가 먼저 잘린다
            testTimeout: 15_000,
            setupFiles: ['./src/shared/test/setup.ts', './src/mocks/testSetup.ts'],
            globals: true,
            css: true,
            // .env는 커밋하지 않아 CI에는 없다. 값이 비면 목 핸들러가 등록하는 경로와
            // API 클라이언트가 요청하는 경로가 어긋나 MSW가 가로채지 못한다.
            env: {
                VITE_API_BASE_URL: '/api',
                VITE_ENABLE_MSW: 'true',
            },
        },
    }),
);
