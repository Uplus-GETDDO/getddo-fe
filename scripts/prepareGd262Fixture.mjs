import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

const filterEntries = (items, eventId) =>
    items.filter((item) => item.eventId === eventId && item.status === 'ACCEPTED');

if (process.argv.includes('--self-test')) {
    assert.deepEqual(
        filterEntries(
            [
                { eventId: 'a', status: 'ACCEPTED' },
                { eventId: 'a', status: 'REJECTED' },
                { eventId: 'b', status: 'ACCEPTED' },
            ],
            'a',
        ),
        [{ eventId: 'a', status: 'ACCEPTED' }],
    );
    assert.deepEqual(filterEntries([], 'a'), []);
    process.stdout.write('이벤트별 접수 응모 필터 검증 통과\n');
    process.exit(0);
}

const [sourcePath, outputPath] = process.argv.slice(2);
assert.ok(sourcePath && outputPath, '원본 fixture와 별도 출력 경로가 필요합니다.');
assert.notEqual(sourcePath, outputPath, '원본 fixture는 덮어쓰지 않습니다.');
const source = readFileSync(sourcePath);
const fixture = JSON.parse(source);
const decode = (stored) => {
    const bytes = Buffer.from(stored.body, 'base64');
    return JSON.parse(stored.headers['content-encoding'] === 'gzip' ? gunzipSync(bytes) : bytes);
};
const full = decode(fixture.responses['USER_A:/api/v1/users/me/entries?page=1&size=50']);
assert.equal(
    full.data.items.length,
    full.data.totalElements,
    '전체 응모가 있어야 파생 가능합니다.',
);

// dev에서 추가된 E06 필터 조회만 완전한 기존 응모 집합에서 재구성한다. 실서버로 요청하지 않는다.
const eventIds = new Set();
for (const [key, stored] of Object.entries(fixture.responses)) {
    if (!key.startsWith('USER_A:/api/v1/events?page=')) continue;
    for (const event of decode(stored).data.items) eventIds.add(event.id);
}
const added = [];
for (const eventId of eventIds) {
    const items = filterEntries(full.data.items, eventId);
    const key = `USER_A:/api/v1/users/me/entries?page=1&size=50&eventId=${eventId}&status=ACCEPTED`;
    if (fixture.responses[key]) {
        const existing = decode(fixture.responses[key]);
        assert.deepEqual(existing.data.items, items, '기존 필터 응답의 집합이 다릅니다.');
        assert.equal(existing.data.totalElements, items.length);
        continue;
    }
    const body = gzipSync(
        Buffer.from(
            JSON.stringify({
                ...full,
                data: { ...full.data, items, page: 1, size: 50, totalElements: items.length },
            }),
        ),
    );
    fixture.responses[key] = {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'content-encoding': 'gzip',
            'content-length': String(body.length),
        },
        body: body.toString('base64'),
    };
    added.push({
        eventHash: createHash('sha256').update(eventId).digest('hex'),
        items: items.length,
    });
}
let syntheticUserResponses = 0;
if (process.argv.includes('--verification-user')) {
    for (const [key, stored] of Object.entries(fixture.responses)) {
        if (!key.startsWith('USER_A:')) continue;
        let response = stored;
        if (key === 'USER_A:/api/v1/tickets/me') {
            const payload = decode(stored);
            payload.data.availableCount = 137;
            payload.data.countByGrade = { BRONZE: 137, SILVER: 0, GOLD: 0, PLATINUM: 0 };
            payload.data.holdings = [
                {
                    grade: 'BRONZE',
                    count: 137,
                    expiresAt: payload.data.holdings[0]?.expiresAt ?? payload.data.serverTime,
                },
            ];
            const body = gzipSync(Buffer.from(JSON.stringify(payload)));
            response = {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'gzip',
                    'content-length': String(body.length),
                },
                body: body.toString('base64'),
            };
        }
        // B의 실서버 데이터가 아니다. 헤더 격리와 별도 잔액 표시를 검증하는 합성 대조군이다.
        fixture.responses[key.replace(/^USER_A:/, 'USER_B:')] = response;
        syntheticUserResponses++;
    }
}
const output = Buffer.from(JSON.stringify(fixture));
writeFileSync(outputPath, output, { flag: 'wx' });
process.stdout.write(
    JSON.stringify(
        {
            kind: '기존 전체 E06에서 eventId·ACCEPTED 필터 응답을 재구성한 통제 데이터',
            sourceHash: createHash('sha256').update(source).digest('hex'),
            fixtureHash: createHash('sha256').update(output).digest('hex'),
            sourceEntries: full.data.totalElements,
            added,
            liveRequests: 0,
            syntheticUserResponses,
            syntheticUserBalance: syntheticUserResponses ? 137 : null,
            limitation: '새 실서버 표본이 아니며 필터 API의 서버 구현 정확성을 검증하지 않습니다.',
        },
        null,
        4,
    ) + '\n',
);
