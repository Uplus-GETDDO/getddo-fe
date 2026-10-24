# GD-340 첫 화면 성능 버짓·회귀 감지 Implementation Plan

**Goal:** 초기 로드 번들 크기 버짓을 정의하고, 빌드 산출물이 버짓을 넘으면 CI가 실패하는 절차를 추가한다. RUM 도입 타당성을 판단해 기록한다.

**Architecture:** `measureGd262Bundle.mjs`의 "index.html 정적 그래프 추적" 로직을 `scripts/lib/`로 추출해 재사용하고, 순수 판정 함수 + CLI 래퍼로 구성한 `checkBundleBudget.mjs`가 `perf-budget.json`의 임계값과 비교한다. 새 dependency 없음(Node 내장 + 기존 typescript devDep). CI는 기존 `npm run build` 뒤에 `npm run perf:budget` 스텝 1개만 추가.

**Tech Stack:** Node 24 ESM 스크립트, Vitest, GitHub Actions.

**Spec:** 사용자 발급 GD-340 지시문(버짓 문서 + CI 감지 + RUM 검토, 완료 조건 = format/lint/test/build 통과 + PR).

## Global Constraints

- 새 dependency 추가 금지 — `package.json` dependencies/devDependencies 변경 없음(승인 게이트).
- 기존 빌드 파이프라인(`tsc -b && vite build`)과 CI 잡 구조 유지 — 스텝 추가만.
- `console.log` 금지 규칙은 src/ 대상 — scripts/*.mjs는 기존처럼 `process.stdout.write` 사용.
- 커밋·PR 본문에 AI 어트리뷰션 트레일러 금지. 브랜치 `fix/GD-340`(사용자 지정).
- 스크립트는 Windows/Git Bash에서도 동작해야 함(경로는 `node:path` 사용).

## 기준선 (2026-10-24 실측, `npm run build` + measureGd262Bundle)

| 지표                     | 현행 실측             | 버짓                | 헤드룸 |
| ------------------------ | --------------------- | ------------------- | ------ |
| 초기 JS gzip 합계        | 237,816 B (232.2 KiB) | 262,144 B (256 KiB) | ~10%   |
| 렌더블로킹 CSS gzip 합계 | 25,178 B (24.6 KiB)   | 30,720 B (30 KiB)   | ~22%   |

근거 문서: `reports/20261024-gd332-bundle-diff.md`(정적 그래프 방식 확정), `reports/20261024-gd334-prod-verification.md`(prod LCP 중앙값 2,641 ms, FCP 2,559 ms, perf 0.93).

---

### Task 1: 정적 그래프 추적 로직을 `scripts/lib/bundleGraph.mjs`로 추출

**Files:**

- Create: `scripts/lib/bundleGraph.mjs`
- Modify: `scripts/measureGd262Bundle.mjs` (중복 로직을 lib 호출로 교체)

**Interfaces:**

- Produces:
    - `visit(file, seen)` — `seen: Set<string>`에 정적 import/export 그래프를 따라 파일을 추가 (기존 measureGd262Bundle의 `visit`과 동일 시그니처·동작)
    - `collectInitial(root)` — `root/index.html`의 `src|href` 루트부터 `visit`을 돌려 initial `Set<string>` 반환
    - `measureAssets(root, initial)` — `dist/assets` 파일별 `{file, initial, raw, gzip, brotli}` 배열 반환

- [ ] **Step 1: lib 파일 작성**

```js
// scripts/lib/bundleGraph.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import ts from 'typescript';

// 생성된 ESM 청크의 정적 의존성만 따라가며 dynamic import는 초기 비용에서 제외한다.
export function visit(file, seen) {
    if (seen.has(file)) return;
    seen.add(file);
    if (!file.endsWith('.js')) return;
    const source = readFileSync(file, 'utf8');
    const parsed = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.JS,
    );
    for (const statement of parsed.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        const specifier = statement.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
            visit(resolve(dirname(file), specifier.text), seen);
        }
    }
}

export function collectInitial(root) {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const roots = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))"/g)].map((m) =>
        join(root, m[1].replace(/^\//, '')),
    );
    const initial = new Set();
    roots.forEach((file) => visit(file, initial));
    return initial;
}

export function measureAssets(root, initial) {
    return readdirSync(join(root, 'assets'))
        .filter((name) => statSync(join(root, 'assets', name)).isFile())
        .map((name) => {
            const file = join(root, 'assets', name);
            const bytes = readFileSync(file);
            return {
                file: basename(file),
                initial: initial.has(file),
                raw: bytes.length,
                gzip: gzipSync(bytes).length,
                brotli: brotliCompressSync(bytes, {
                    params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
                }).length,
            };
        });
}
```

- [ ] **Step 2: `measureGd262Bundle.mjs`를 lib 호출로 교체**

상단 import·`visit`·파일 수집 블록을 아래로 교체(나머지 `sum`·`result`·출력 로직 불변, `visit`은 routeChunks 계산에서 계속 씀):

```js
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectInitial, measureAssets, visit } from './lib/bundleGraph.mjs';

const root = process.argv[3] ?? 'dist';
const initial = collectInitial(root);
const files = measureAssets(root, initial);
```

- [ ] **Step 3: 회귀 확인 — 산출물이 리팩터 전과 동일한지**

```bash
node scripts/measureGd262Bundle.mjs reports/20261024-gd340-baseline-bundle.json dist
# 기대 stdout: {"initialJs":{"raw":754071,"gzip":237816,...},"initialCss":{"raw":147246,"gzip":25178,...}}
```

### Task 2: 버짓 판정 스크립트 + 테스트 + npm 스크립트 + CI 스텝

**Files:**

- Create: `perf-budget.json` (리포 루트)
- Create: `scripts/checkBundleBudget.mjs`
- Create: `scripts/checkBundleBudget.test.mjs`
- Modify: `package.json` (scripts에 `perf:budget` 추가 — dependencies 변경 아님)
- Modify: `.github/workflows/ci.yml` (build 뒤에 1스텝)

**Interfaces:**

- `evaluateBudget(metrics, budget)` → `{ violations: [{key, actual, limit}], ok: boolean }` 순수 함수(테스트 대상)
- CLI: `node scripts/checkBundleBudget.mjs [distDir] [budgetPath]` — 기본 `dist`·`perf-budget.json`. 위반 시 위반 목록을 stderr에 출력하고 `process.exit(1)`, 통과 시 요약을 stdout에 출력하고 0.

- [ ] **Step 1: 실패 테스트 작성** — `scripts/checkBundleBudget.test.mjs`

```js
import { describe, expect, it } from 'vitest';
import { evaluateBudget } from './checkBundleBudget.mjs';

const budget = {
    initialJsGzipBytes: 262144,
    initialCssGzipBytes: 30720,
};

describe('evaluateBudget', () => {
    it('두 지표 모두 버짓 이내면 ok', () => {
        const r = evaluateBudget({ initialJsGzip: 237816, initialCssGzip: 25178 }, budget);
        expect(r.ok).toBe(true);
        expect(r.violations).toEqual([]);
    });
    it('초기 JS 초과 시 해당 항목만 violation', () => {
        const r = evaluateBudget({ initialJsGzip: 262145, initialCssGzip: 25178 }, budget);
        expect(r.ok).toBe(false);
        expect(r.violations).toEqual([{ key: 'initialJsGzip', actual: 262145, limit: 262144 }]);
    });
    it('CSS 초과도 violation으로 보고', () => {
        const r = evaluateBudget({ initialJsGzip: 1, initialCssGzip: 30721 }, budget);
        expect(r.violations).toEqual([{ key: 'initialCssGzip', actual: 30721, limit: 30720 }]);
    });
});
```

- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run scripts/checkBundleBudget.test.mjs` → `evaluateBudget` 미정의로 FAIL.

- [ ] **Step 3: `perf-budget.json` 작성**

```json
{
    "comment": "GD-340 — 초기 로드 정적 그래프 버짓. 수치·근거는 docs/performance-budget.md. 기준선(2026-10-24): JS gzip 237,816B / CSS gzip 25,178B.",
    "initialJsGzipBytes": 262144,
    "initialCssGzipBytes": 30720
}
```

- [ ] **Step 4: `checkBundleBudget.mjs` 구현**

```js
// GD-340 — vite build 산출물의 초기 로드 버짓 검사. 위반 시 exit 1.
// 사용: node scripts/checkBundleBudget.mjs [distDir=dist] [budgetPath=perf-budget.json]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectInitial, measureAssets } from './lib/bundleGraph.mjs';

export function evaluateBudget(metrics, budget) {
    const checks = [
        ['initialJsGzip', metrics.initialJsGzip, budget.initialJsGzipBytes],
        ['initialCssGzip', metrics.initialCssGzip, budget.initialCssGzipBytes],
    ];
    const violations = checks
        .filter(([, actual, limit]) => actual > limit)
        .map(([key, actual, limit]) => ({ key, actual, limit }));
    return { violations, ok: violations.length === 0 };
}

const isCli =
    process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;
// Windows 경로(`C:\...`)와 POSIX 경로 모두 대응되도록 pathToFileURL 비교를 쓴다.
if (process.argv[1] === undefined) {
    // import 전용
} else {
    const { pathToFileURL } = await import('node:url');
    if (import.meta.url === pathToFileURL(process.argv[1]).href) {
        const root = resolve(process.argv[2] ?? 'dist');
        const budget = JSON.parse(
            readFileSync(resolve(process.argv[3] ?? 'perf-budget.json'), 'utf8'),
        );
        const initial = collectInitial(root);
        const files = measureAssets(root, initial);
        const sum = (pred) => files.filter(pred).reduce((t, f) => t + f.gzip, 0);
        const metrics = {
            initialJsGzip: sum((f) => f.initial && f.file.endsWith('.js')),
            initialCssGzip: sum((f) => f.initial && f.file.endsWith('.css')),
        };
        const { violations, ok } = evaluateBudget(metrics, budget);
        const fmt = (n) => `${n} B (${(n / 1024).toFixed(1)} KiB)`;
        if (!ok) {
            for (const v of violations) {
                process.stderr.write(
                    `[perf-budget] ${v.key} 초과: ${fmt(v.actual)} > ${fmt(v.limit)}\n`,
                );
            }
            process.exit(1);
        }
        process.stdout.write(
            `[perf-budget] 통과 — initialJsGzip ${fmt(metrics.initialJsGzip)}, initialCssGzip ${fmt(metrics.initialCssGzip)}\n`,
        );
    }
}
```

(구현 시 `isCli` 잔재는 정리하고 pathToFileURL 비교만 남긴다.)

- [ ] **Step 5: 테스트 통과 확인** — `npx vitest run scripts/checkBundleBudget.test.mjs` → PASS. 이어 `node scripts/checkBundleBudget.mjs` → 통과 요약 + exit 0.

- [ ] **Step 6: package.json 스크립트·CI 스텝 추가**

```jsonc
"build": "tsc -b && vite build",
"perf:budget": "node scripts/checkBundleBudget.mjs",
```

```yaml
- run: npm run build
- run: npm run perf:budget
```

### Task 3: 버짓 문서 + RUM 판단 기록

**Files:**

- Create: `docs/performance-budget.md`
- Modify: `AGENTS.md`의 "검증 명령" 섹션 아래 한 줄 — `npm run perf:budget  # 초기 번들 버짓(dist 필요)` 추가 여부는 문서에 명시하고 AGENTS.md는 건드리지 않는다(규칙 파일 변경 최소화). 대신 CONTRIBUTING.md에 검증 절차 섹션이 있으면 거기에만 추가.

- [ ] **Step 1: 문서 작성** — 포함 내용:
    - 지표 정의: "초기 로드" = index.html이 참조하는 정적 import 그래프(measureGd262Bundle 방식, dynamic import 제외). gzip은 배포 환경과 무관하게 재현 가능한 최소 단위 — prod는 brotli라 다소 보수적.
    - 수치 표: 기준선/버짓/헤드룸(위 표 그대로) + prod Lighthouse 목표 예산: LCP ≤ 2.5s·FCP ≤ 1.8s (p75 모바일, "Good" 상한, 현행 중앙값 LCP 2,641 ms는 경계라 주의 필요 문구).
    - 조정 절차: 버짓 상향이 필요하면 PR 본문에 신규 실측 근거를 적고 이 문서의 기준선 표를 갱신한다 — 임계값만 올리는 diff는 리뷰에서 반려.
    - 재현: `npm run build && npm run perf:budget`, 상세는 `node scripts/measureGd262Bundle.mjs <out.json> dist`.
    - RUM 판단: **보류** — 수집 엔드포인트·분석 백엔드가 없고 `web-vitals`/`@vercel/speed-insights` 추가는 dependency 승인 게이트 대상. 전제 조건·권고 경로(Vercel Speed Insights가 최소 비용)를 명시. dev 모드 로깅만 하는 절반 도입은 데이터가 남지 않아 가치 없음을 명기.

- [ ] **Step 2: `format` 실행 후 전체 검증** — `npm run format && npm run format:check && npm run lint && npm run test:ci && npm run build && npm run perf:budget` 전부 통과.

- [ ] **Step 3: 커밋·PR** — `fix/GD-340`에 conventional 커밋, `dev` 대상 PR(템플릿 전부 기입, AI 트레일러 없음).
