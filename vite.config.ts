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
                        // dynamic import의 dep 프리로드 헬퍼 — router 청크에 들어가면 entry가 react·router를
                        // 정적 import하게 돼 부트 지연(GD-348)의 의도가 깨진다. 전용 소형 청크로 분리한다.
                        {
                            name: 'preload-helper',
                            test: /preload-helper|vite-preload|commonjsHelpers|rolldown/,
                            priority: 5,
                        },
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
                        // react-table은 관리자 테이블 전용 — react-query와 같은 청크로 묶으면 초기 로드에 끼어든다
                        {
                            name: 'tanstack',
                            test: /node_modules[\\/]@tanstack[\\/](?!react-table[\\/]|table-core[\\/]|react-store[\\/]|store[\\/])/,
                            priority: 2,
                        },
                        { name: 'zod', test: /node_modules[\\/]zod[\\/]/, priority: 2 },
                        // 차트(recharts와 그 의존성)·애니메이션(framer-motion 계열)·폼(react-hook-form)·온보딩 투어(driver.js)는
                        // lazy 화면에서만 쓴다 — 사용자 화면이 함께 받는 vendor에서 빼 지연 청크로 보낸다.
                        // 별도 그룹으로 묶으면 공용 런타임 함수가 그쪽에 들어가 첫 화면이 끌어온다
                        {
                            name: 'vendor',
                            test: /node_modules[\\/](?!(recharts|victory-vendor|d3-[a-z-]+|internmap|decimal\.js-light|@reduxjs|redux|redux-thunk|react-redux|reselect|immer|es-toolkit|eventemitter3|tiny-invariant|framer-motion|motion-dom|motion-utils|react-hook-form|@hookform|driver\.js)[\\/])/,
                            priority: 1,
                        },
                    ],
                },
            },
        },
    },
});
