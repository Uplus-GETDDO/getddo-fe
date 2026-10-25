import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// 부트 지연 구조(GD-348, main.tsx의 setTimeout → import('./bootstrap'))에서 부팅 그래프의
// fetch만 첫 페인트 창으로 앞당긴다. modulepreload는 fetch·compile만 하고 평가는 import()
// 시점까지 미뤄지므로 FCP 이득을 유지한 채 LCP 체인의 네트워크 지연을 없앤다.
function preloadBootGraph(): Plugin {
    return {
        name: 'preload-boot-graph',
        apply: 'build',
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                const bundle = ctx.bundle;
                if (!bundle) return html;
                const boot = Object.values(bundle).find(
                    (asset) =>
                        asset.type === 'chunk' &&
                        asset.isDynamicEntry &&
                        asset.facadeModuleId
                            ?.replaceAll('\\', '/')
                            .endsWith('src/app/bootstrap.tsx'),
                );
                if (!boot) {
                    this.error(
                        'preload-boot-graph: bootstrap 동적 entry를 찾지 못했다 — src/app/bootstrap.tsx를 옮겼다면 이 매칭 조건을 갱신하라',
                    );
                }
                const files = new Set<string>();
                const collect = (fileName: string) => {
                    if (files.has(fileName)) return;
                    files.add(fileName);
                    const chunk = bundle[fileName];
                    if (chunk?.type === 'chunk') chunk.imports.forEach(collect);
                };
                collect(boot.fileName);
                // entry 정적 dep(preload-helper 등)은 Vite가 이미 넣은 링크와 중복되지 않게 걸러낸다
                const existing = new Set(
                    [...html.matchAll(/href="\/(assets\/[^"]+)"/g)].map((m) => m[1]),
                );
                // 대형 vendor 청크까지 조기 fetch하면 첫 페인트와 대역을 다퉈 FCP가 밀린다(로컬 sim
                // +1.4s 실측). 두 청크만 기존 import() 시점의 병렬 fetch에 맡기면 선행 바이트가
                // ~1/3으로 줄어 FCP를 지키면서 부팅 체인 대부분을 앞당긴다.
                const LATE_FETCH = new Set(['vendor', 'react']);
                return {
                    html,
                    tags: [...files]
                        .filter((f) => !existing.has(f))
                        .filter((f) => {
                            const chunk = bundle[f];
                            return !(chunk?.type === 'chunk' && LATE_FETCH.has(chunk.name));
                        })
                        .map((file) => ({
                            tag: 'link',
                            attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
                            injectTo: 'head' as const,
                        })),
                };
            },
        },
    };
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react({
            // React Compiler — props·state 불변성은 eslint react-hooks 규칙이 이미 강제한다
            compiler: { logDiagnostics: true },
        }),
        tailwindcss(),
        preloadBootGraph(),
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
