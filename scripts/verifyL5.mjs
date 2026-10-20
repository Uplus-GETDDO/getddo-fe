// 읽기 전용 실서버 검증. 사용자·관리자는 등록된 시연 UUID를 인자로 전달한다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(source) {
    const file = path.resolve(source);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(
        (name) =>
            name === '@entities/ticket'
                ? load('src/entities/ticket/model/types.ts')
                : name.startsWith('.')
                  ? load(path.resolve(path.dirname(file), name + '.ts'))
                  : require(name),
        module,
        module.exports,
    );
    return module.exports;
}
const [base, userId, adminId, output] = process.argv.slice(2);
if (!base || !userId || !adminId || !output)
    throw new Error('API 기본 URL·시연 USER UUID·ADMIN UUID·결과 파일이 필요합니다.');
const attendance = load('src/entities/attendance/model/adminTypes.ts');
const attendanceUser = load('src/entities/attendance/model/types.ts');
const mission = load('src/entities/mission/model/adminTypes.ts');
const missionUser = load('src/entities/mission/model/types.ts');
const event = load('src/entities/event/model/contract.ts');
const entry = load('src/entities/entry/model/types.ts');
const report = {
    at: new Date().toISOString(),
    base,
    kind: '실제 API 읽기 전용; MSW 없음',
    deploymentVersion: '응답 헤더에서 확인 가능한 버전만 기록',
    checks: [],
};
function save() {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
async function request(url, schema, role = 'USER') {
    const start = performance.now();
    const response = await fetch(base + url, {
        headers: {
            'X-User-ID': role === 'ADMIN' ? adminId : userId,
            'X-User-Role': role,
            ...(role === 'USER' ? { 'X-User-Membership': 'excellent' } : {}),
        },
        signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text();
    const json = JSON.parse(raw);
    const parsed = schema?.safeParse(json.data);
    report.checks.push({
        path: url,
        role,
        status: response.status,
        code: json.code,
        envelope: json.success === true,
        schema: parsed ? parsed.success : null,
        issues:
            parsed && !parsed.success
                ? parsed.error.issues.map((i) => ({ path: i.path, message: i.message }))
                : undefined,
        decodedBytes: Buffer.byteLength(raw),
        elapsedMs: Math.round(performance.now() - start),
        version: response.headers.get('x-version') ?? response.headers.get('x-commit-sha'),
        count: json.data?.totalElements,
    });
    save();
    return json.data;
}
const { z } = require('zod');
const page = (schema) =>
    z.object({
        items: z.array(schema),
        page: z.number(),
        size: z.number(),
        totalElements: z.number(),
    });
async function collect(url, size, schema) {
    const start = performance.now();
    const before = report.checks.length;
    const items = [];
    for (let n = 1; ; n++) {
        const data = await request(`${url}?page=${n}&size=${size}`, page(schema));
        if (!data?.items) throw new Error(`전체 수집 실패: ${url} page=${n}`);
        items.push(...data.items);
        if (items.length >= data.totalElements) break;
        if (!data.items.length) throw new Error('전체 수집 중 빈 페이지');
    }
    report.checks.push({
        name: `${url} 전체 수집`,
        rows: items.length,
        requests: report.checks.length - before,
        decodedBytes: report.checks
            .slice(before)
            .reduce((sum, x) => sum + (x.decodedBytes ?? 0), 0),
        elapsedMs: Math.round(performance.now() - start),
    });
    save();
    return items;
}
const events = await collect('/events', 20, event.eventSummaryResponseSchema);
const entries = await collect('/users/me/entries', 50, entry.entrySchema);
await request('/attendances/today', attendanceUser.attendanceTodaySchema);
await request('/attendances?month=2026-10', attendanceUser.attendanceMonthSchema);
await request(
    '/admin/policies/attendance/daily?page=1&size=20',
    page(attendance.dailyAttendancePolicySchema),
    'ADMIN',
);
await request(
    '/admin/policies/attendance/streak?page=1&size=20',
    page(attendance.streakPolicySetSchema),
    'ADMIN',
);
await request('/admin/policies/attendance/daily?page=1&size=20', undefined, 'USER');
const missions = await request(
    '/admin/missions?page=1&size=20',
    page(mission.adminMissionSummarySchema),
    'ADMIN',
);
await request('/admin/missions?page=1&size=20', undefined, 'USER');
for (const m of (missions?.items ?? []).slice(0, 4)) {
    await request(`/admin/missions/${m.id}`, mission.adminMissionSchema, 'ADMIN');
    await request(`/missions/${m.id}`, missionUser.missionDetailSchema);
    await request(
        `/missions/${m.id}/submissions/me?page=1&size=20`,
        page(missionUser.missionSubmissionResultSchema),
    );
    if (m.missionType === 'SURVEY')
        await request(
            `/admin/missions/${m.id}/survey-summary?from=2026-10-01&to=2026-10-20`,
            mission.surveySummarySchema,
            'ADMIN',
        );
}
for (const e of events.slice(0, 3))
    await request(`/events/${e.id}`, event.eventDetailResponseSchema);
const resultIds = [
    ...new Set(entries.filter((e) => e.status === 'ACCEPTED').map((e) => e.eventId)),
];
report.checks.push({ name: 'E09 최초 요청 대상', distinctAcceptedEvents: resultIds.length });
save();
console.log(
    JSON.stringify({
        checks: report.checks.length,
        failures: report.checks.filter(
            (c) => c.schema === false || (c.status && c.status !== 200 && c.status !== 403),
        ).length,
        collections: report.checks.filter((c) => c.name),
    }),
);
