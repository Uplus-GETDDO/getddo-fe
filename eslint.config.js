import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const SLICED_LAYERS = ['widgets', 'features', 'entities'];

// 슬라이스 내부 파일 직접 import 차단 셀렉터 — 슬라이스 루트의 index.ts(x)만 공개 API다.
// '*/**'가 하위 폴더의 모든 파일(index.ts 포함)을, '!(index.ts|index.tsx)'가 루트의 index 외 파일을 차단한다.
// (과거 '**/!(index.ts|index.tsx)'는 ui/index.ts 같은 세그먼트 barrel을 통과시키는 허점이 있었다)
const DEEP_IMPORT_OF_SLICE = {
    to: {
        element: {
            types: { anyOf: SLICED_LAYERS },
            fileInternalPath: ['*/**', '!(index.ts|index.tsx)'],
        },
    },
};
// pages는 배럴(index.ts) 없이 슬라이스 루트의 XxxPage.tsx를 라우트가 직접 import한다.
// 대신 ui/·model/·hooks/·utils/ 등 하위 세그먼트 파일의 외부 참조만 차단한다 ('*/**'는 하위 폴더 파일만 매칭).
const DEEP_IMPORT_OF_PAGE_SLICE = {
    to: {
        element: { type: 'pages', fileInternalPath: '*/**' },
    },
};
// FSD 레이어 의존 방향: app → pages → widgets → features → entities → shared
// 같은 레이어의 다른 슬라이스 간 참조는 allow 목록에 자기 자신이 없어 자동 차단된다.
// 정책 내부에서는 disallow가 allow보다 우선하므로 딥 임포트 차단을 각 정책에 둔다.
const FSD_DEPENDENCY_POLICIES = [
    {
        from: { element: { type: 'app' } },
        disallow: [DEEP_IMPORT_OF_SLICE, DEEP_IMPORT_OF_PAGE_SLICE],
        allow: [
            {
                to: {
                    element: {
                        types: { anyOf: ['app', 'pages', ...SLICED_LAYERS, 'shared', 'mocks'] },
                    },
                },
            },
        ],
    },
    {
        // 목업은 서버 응답을 흉내 내는 인프라 — entities 스키마·타입과 shared를 참조해 계약이 한 군데가 된다
        from: { element: { type: 'mocks' } },
        allow: [{ to: { element: { types: { anyOf: ['mocks', 'entities', 'shared'] } } } }],
    },
    {
        from: { element: { type: 'pages' } },
        disallow: [DEEP_IMPORT_OF_SLICE],
        allow: [
            {
                to: {
                    element: {
                        types: { anyOf: ['widgets', 'features', 'entities', 'shared'] },
                    },
                },
            },
        ],
    },
    {
        from: { element: { type: 'widgets' } },
        disallow: [DEEP_IMPORT_OF_SLICE],
        allow: [{ to: { element: { types: { anyOf: ['features', 'entities', 'shared'] } } } }],
    },
    {
        from: { element: { type: 'features' } },
        disallow: [DEEP_IMPORT_OF_SLICE],
        allow: [{ to: { element: { types: { anyOf: ['entities', 'shared'] } } } }],
    },
    {
        from: { element: { type: 'entities' } },
        disallow: [DEEP_IMPORT_OF_SLICE],
        allow: [{ to: { element: { types: { anyOf: ['shared'] } } } }],
    },
    {
        from: { element: { type: 'shared' } },
        disallow: [DEEP_IMPORT_OF_SLICE],
        allow: [{ to: { element: { types: { anyOf: ['shared'] } } } }],
    },
];

export default tseslint.config(
    {
        ignores: [
            'dist',
            'node_modules',
            'coverage',
            'public/mockServiceWorker.js',
            '**/.claude-worktrees/**',
        ],
    },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            'boundaries/include': ['src/**/*.{ts,tsx}'],
            'boundaries/elements': [
                { type: 'app', pattern: 'src/app/*' },
                // 더 구체적인 패턴을 먼저 — 관리자 페이지 각각이 독립 슬라이스다 (하위 페이지끼리의 참조도 차단된다)
                { type: 'pages', pattern: 'src/pages/admin/*' },
                { type: 'pages', pattern: 'src/pages/*' },
                { type: 'widgets', pattern: 'src/widgets/*' },
                { type: 'features', pattern: 'src/features/*' },
                { type: 'entities', pattern: 'src/entities/*' },
                { type: 'shared', pattern: 'src/shared/*' },
                // src/mocks는 FSD 레이어가 아닌 독립 요소 — 슬라이스 공개 API 규칙 대상이 아니다
                { type: 'mocks', pattern: 'src/mocks/*' },
            ],
            // @app/@pages/... 경로 별칭을 boundaries가 해석할 수 있도록 tsconfig paths 기반 resolver 사용
            'import/resolver': {
                typescript: { project: './tsconfig.app.json' },
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            boundaries,
            perfectionist,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            // verbatimModuleSyntax와 짝 — 타입은 import type으로 강제, 배럴 경유 순환 참조 위험 감소
            '@typescript-eslint/consistent-type-imports': 'error',
            // 디버그 로그 커밋 방지 — warn/error는 허용
            'no-console': ['error', { allow: ['warn', 'error'] }],
            // import 정렬 — 외부 패키지 → 내부 alias → 상대경로 순
            'perfectionist/sort-imports': [
                'error',
                {
                    type: 'alphabetical',
                    order: 'asc',
                    newlinesBetween: 1,
                    internalPattern: [
                        '^@/',
                        '^@(app|pages|widgets|features|entities|shared|mocks)(/|$)',
                    ],
                },
            ],
            // FSD: 레이어 의존 방향 + 같은 레이어 슬라이스 간 참조 차단 + 슬라이스 공개 API(index.ts) 강제
            'boundaries/dependencies': [
                'error',
                {
                    default: 'disallow',
                    message:
                        'FSD 규칙 위반: "{{dependency.source}}" — 상위→하위 레이어 참조만 허용되고, 같은 레이어의 다른 슬라이스와 슬라이스 내부 파일(index.ts 외)은 참조할 수 없습니다.',
                    policies: FSD_DEPENDENCY_POLICIES,
                },
            ],
            // 환경변수는 shared/config/env.ts를 통해서만 접근
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "MemberExpression[object.type='MetaProperty'][object.property.name='meta'][property.name='env']",
                    message:
                        'import.meta.env 직접 참조 금지 — @shared/config/env의 env 객체를 사용하세요.',
                },
            ],
        },
    },
    {
        // env.ts 자체는 import.meta.env 접근이 목적인 파일이므로 예외
        files: ['src/shared/config/env.ts'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        // shadcn 생성물(variant 상수와 컴포넌트를 함께 export하는 표준 패턴), 배럴 파일,
        // 라우트 정의 파일(lazy 페이지 래퍼와 RouteObject를 함께 둠)은 fast-refresh 경고 제외
        files: ['src/shared/ui/**', '**/index.ts', '**/index.tsx', 'src/app/routes/**'],
        rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
        // Node 환경에서 실행되는 설정 파일
        files: ['*.config.{js,ts}', 'vitest.config.ts'],
        languageOptions: { globals: globals.node },
    },
);
