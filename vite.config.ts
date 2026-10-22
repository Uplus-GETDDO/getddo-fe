import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react({
            // React Compiler — props·state 불변성은 eslint react-hooks 규칙이 이미 강제한다
            compiler: { logDiagnostics: true },
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
            '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
            '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
            '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
            '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
            '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
            '@mocks': fileURLToPath(new URL('./src/mocks', import.meta.url)),
        },
    },
    build: {
        rolldownOptions: {
            output: {
                // 벤더를 entry(index)와 분리해 캐시 수명을 나눈다. Windows 경로까지 매칭되도록 구분자는 [\\/] 로 쓴다.
                // 목업은 dynamic import라 msw 전용 의존성을 vendor에서 분리해 초기 로드 경로 밖에 둔다 —
                // cookie·path-to-regexp는 react-router도 쓰므로 msw 그룹에 넣으면 오히려 초기 경로로 끌려온다
                codeSplitting: {
                    groups: [
                        {
                            name: 'msw',
                            test: /node_modules[\\/](msw|@mswjs|@open-draft|@inquirer|graphql|headers-polyfill|is-node-process|outvariant|picocolors|rettime|statuses|strict-event-emitter|tough-cookie|type-fest|until-async|yargs)[\\/]/,
                            priority: 4,
                        },
                        {
                            name: 'react',
                            test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                            priority: 3,
                        },
                        { name: 'router', test: /node_modules[\\/]react-router/, priority: 2 },
                        { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/, priority: 2 },
                        { name: 'zod', test: /node_modules[\\/]zod[\\/]/, priority: 2 },
                        // 차트(recharts와 그 의존성)는 관리자 대시보드에서만 쓴다 — 사용자 화면이 함께 받는 vendor에서 빼
                        // 대시보드 지연 로딩 청크로 가게 한다. 별도 그룹으로 묶으면 공용 런타임 함수가 그쪽에 들어가 첫 화면이 끌어온다
                        {
                            name: 'vendor',
                            test: /node_modules[\\/](?!(recharts|victory-vendor|d3-[a-z-]+|internmap|decimal\.js-light|@reduxjs|redux|redux-thunk|react-redux|reselect|immer|es-toolkit|eventemitter3|tiny-invariant)[\\/])/,
                            priority: 1,
                        },
                    ],
                },
            },
        },
    },
});
