// 실행: node scripts/verifyL4.mjs <API 기본 URL> <시연 USER UUID> <시연 ADMIN UUID> <결과 파일>
// 시작·결과 요청은 시연 계정의 통계·보상에 영향을 준다. 응답 토큰은 파일이나 로그에 남기지 않는다.
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
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (name) =>
        name === '@entities/ticket'
            ? load('src/entities/ticket/model/types.ts')
            : name.startsWith('.')
              ? load(path.resolve(path.dirname(file), name + '.ts'))
              : require(name);
    new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
    return module.exports;
}
const [base, userId, adminId, output, mode] = process.argv.slice(2);
if (!base || !userId || !adminId || !output)
    throw new Error('API URL, 시연 USER UUID, ADMIN UUID, 결과 파일을 지정하세요.');
const sessionModel = load('src/features/playGame/model/gameSession.ts');
const colorModel = load('src/features/playGame/model/colorWord.ts');
const timingModel = load('src/features/playGame/model/takkoTiming.ts');
const orderModel = load('src/features/playGame/model/takkoOrder.ts');
const runModel = load('src/features/playGame/model/takkoRun.ts');
const schemas = load('src/features/playGame/model/types.ts');
const report = { at: new Date().toISOString(), base, kind: '실제 API 직접 호출', checks: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const check = (name, data) => {
    report.checks.push({ name, ...data });
    save();
    console.log(name, JSON.stringify(data));
};
async function request(method, url, body, role = 'USER') {
    const response = await fetch(base + url, {
        method,
        headers: {
            'X-User-ID': role === 'ADMIN' ? adminId : userId,
            'X-User-Role': role,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    return {
        status: response.status,
        code: json.code,
        data: json.data,
        retryAfter: response.headers.get('retry-after'),
    };
}
function inputFor(code, start) {
    const random = sessionModel.createXorshift32(start.gameData.seed);
    if (code === 'COLOR_WORD') {
        let previous;
        const answers = [];
        for (let i = 0; i < 8; i++) {
            const round = colorModel.createColorWordRound(random, previous);
            previous = round;
            answers.push({
                sequence: i + 1,
                answer: i < 5 ? round.ink : null,
                elapsedMs: i < 5 ? 0 : 2600,
            });
        }
        return { input: { answers }, expected: 50 };
    }
    if (code === 'TAKKO_TIMING') {
        let previous;
        const taps = [];
        let successes = 0;
        for (const desired of ['perfect', 'perfect', 'hit', 'miss']) {
            const round = timingModel.createTakkoTimingRound(random, successes, previous);
            previous = round;
            let elapsedMs = 0;
            while (
                timingModel.judgeTakkoTiming(
                    timingModel.takkoTimingPosition(elapsedMs, round.sweepMs),
                    round,
                ) !== desired
            )
                elapsedMs++;
            taps.push({ sequence: taps.length + 1, elapsedMs });
            if (desired !== 'miss') successes++;
        }
        return { input: { taps }, expected: 50 };
    }
    if (code === 'TAKKO_ORDER') {
        const rounds = [];
        let length = 3;
        for (let i = 0; i < 7; i++) {
            const order = orderModel.createTakkoOrder(length, random);
            const picks =
                i < 4
                    ? order
                    : [orderModel.TAKKO_ORDER_MENU.find((menu) => menu.id !== order[0]).id];
            rounds.push({ sequence: i + 1, picks });
            if (i < 4) length++;
        }
        return { input: { rounds }, expected: 18 };
    }
    const engine = new sessionModel.FixedRun(start.gameData.seed, 72000);
    engine.input('press');
    let holding = true;
    while (engine.run.phase !== 'over') {
        const run = engine.run;
        const score = runModel.scoreOf(run);
        // 기준 점수에 도달하면 추가 입력을 멈추고 다음 충돌에서 자연 종료한다.
        if (score < 400 && run.height === 0 && run.velocity === 0) {
            const obstacle = run.obstacles.find((obstacle) => obstacle.x + obstacle.width > 118);
            if (obstacle && obstacle.x < 300) {
                engine.input('press');
                holding = true;
            }
        }
        if (holding && run.velocity < 0) {
            engine.input('release');
            holding = false;
        }
        engine.advance(1 / 120);
    }
    return {
        input: { endTick: engine.endTick, inputs: engine.inputs },
        expected: runModel.scoreOf(engine.run),
    };
}
const list = await request('GET', '/games');
check('G01', { status: list.status, codes: list.data?.map((game) => game.code) });
if (list.status !== 200) throw new Error('G01 실패');
if (mode !== 'edges')
    for (const game of list.data) {
        const detail = await request('GET', `/games/${game.id}`);
        const before = await request('GET', `/games/${game.id}/statistics/me`);
        const walletBefore = await request('GET', '/tickets/me');
        check(`${game.code} 조회`, { detailStatus: detail.status, statisticsBefore: before.data });
        const start = await request('POST', `/games/${game.id}/plays`);
        if (start.status !== 201) throw new Error(`${game.code} 시작 실패 ${start.code}`);
        schemas.gameStartSchema.parse(start.data);
        const { input, expected } = inputFor(game.code, start.data);
        const body = { playToken: start.data.playToken, validationData: input };
        let result = await request(
            'PUT',
            `/games/${game.id}/plays/${start.data.playId}/result`,
            body,
        );
        if (result.status === 429) {
            check('429 실제 대기', { status: 429, retryAfter: result.retryAfter });
            await new Promise((resolve) =>
                setTimeout(resolve, (Number(result.retryAfter) || 60) * 1000 + 100),
            );
            result = await request(
                'PUT',
                `/games/${game.id}/plays/${start.data.playId}/result`,
                body,
            );
        }
        if (result.status === 200) schemas.playResultSchema.parse(result.data);
        const duplicate = await request(
            'PUT',
            `/games/${game.id}/plays/${start.data.playId}/result`,
            body,
        );
        const after = await request('GET', `/games/${game.id}/statistics/me`);
        const walletAfter = await request('GET', '/tickets/me');
        const histories = await request('GET', '/tickets/histories/me?size=100');
        const reward = result.data?.reward;
        check(`${game.code} 결과·중복·보상`, {
            startStatus: start.status,
            resultStatus: result.status,
            result: result.data,
            expectedScore: expected,
            scoreMatches: result.data?.score === expected,
            duplicateStatus: duplicate.status,
            duplicateMatches: JSON.stringify(duplicate.data) === JSON.stringify(result.data),
            statisticsAfter: after.data,
            validPlayDelta: after.data.validPlayCount - before.data.validPlayCount,
            totalScoreDelta: after.data.totalScore - before.data.totalScore,
            walletDelta: walletAfter.data.availableCount - walletBefore.data.availableCount,
            gradeDelta: reward
                ? walletAfter.data.countByGrade[reward.grade] -
                  walletBefore.data.countByGrade[reward.grade]
                : null,
            historyStatus: histories.status,
            gameHistories: histories.data?.items
                ?.filter((item) => item.gameId === game.id)
                .map((item) => ({
                    grade: item.grade,
                    operationType: item.operationType,
                    createdAt: item.createdAt,
                    expiresAt: item.expiresAt,
                })),
        });
        if (result.data?.status !== 'VALID' || result.data.score !== expected)
            throw new Error(`${game.code} 서버 판정 불일치`);
        const adminStart = await request('POST', `/games/${game.id}/plays`, undefined, 'ADMIN');
        const adminStats = await request(
            'GET',
            `/games/${game.id}/statistics/me`,
            undefined,
            'ADMIN',
        );
        const adminSubmit =
            adminStart.status === 201
                ? await request(
                      'PUT',
                      `/games/${game.id}/plays/${adminStart.data.playId}/result`,
                      { playToken: adminStart.data.playToken, validationData: input },
                      'ADMIN',
                  )
                : null;
        check(`${game.code} ADMIN`, {
            startStatus: adminStart.status,
            statisticsStatus: adminStats.status,
            statisticsCode: adminStats.code,
            submitStatus: adminSubmit?.status,
            submitCode: adminSubmit?.code,
        });
    }

if (mode === 'edges') {
    const put = async (url, body) => {
        let result = await request('PUT', url, body);
        if (result.status === 429) {
            check('429 실제 빈도 제한', {
                status: 429,
                code: result.code,
                retryAfter: result.retryAfter,
            });
            await new Promise((resolve) =>
                setTimeout(resolve, (Number(result.retryAfter) || 60) * 1000 + 100),
            );
            result = await request('PUT', url, body);
        }
        return result;
    };
    for (const game of list.data) {
        const start = (await request('POST', `/games/${game.id}/plays`)).data;
        const random = sessionModel.createXorshift32(start.gameData.seed);
        let validationData;
        let expected = 0;
        if (game.code === 'COLOR_WORD')
            validationData = {
                answers: [1, 2, 3].map((sequence) => ({ sequence, answer: null, elapsedMs: 3000 })),
            };
        if (game.code === 'TAKKO_TIMING')
            validationData = { taps: [{ sequence: 1, elapsedMs: 0 }] };
        if (game.code === 'TAKKO_ORDER') {
            const rounds = [];
            for (let i = 0; i < 3; i++) {
                const order = orderModel.createTakkoOrder(3, random);
                rounds.push({
                    sequence: i + 1,
                    picks: [orderModel.TAKKO_ORDER_MENU.find((menu) => menu.id !== order[0]).id],
                });
            }
            validationData = { rounds };
        }
        if (game.code === 'TAKKO_RUN') {
            const engine = new sessionModel.FixedRun(start.gameData.seed, 72000);
            engine.input('press');
            while (engine.run.phase !== 'over') engine.advance(1 / 120);
            validationData = { endTick: engine.endTick, inputs: engine.inputs };
            expected = runModel.scoreOf(engine.run);
        }
        const url = `/games/${game.id}/plays/${start.playId}/result`;
        const body = { playToken: start.playToken, validationData };
        const result = await put(url, body);
        check(`${game.code} 기준 미달`, {
            status: result.status,
            result: result.data,
            expectedScore: expected,
            scoreMatches: result.data?.score === expected,
        });
        if (
            result.data?.status !== 'VALID' ||
            result.data.score !== expected ||
            result.data.reward !== null
        )
            throw new Error('기준 미달 검증 실패');
        const invalidStart = (await request('POST', `/games/${game.id}/plays`)).data;
        const empty =
            game.code === 'COLOR_WORD'
                ? { answers: [] }
                : game.code === 'TAKKO_TIMING'
                  ? { taps: [] }
                  : game.code === 'TAKKO_ORDER'
                    ? { rounds: [] }
                    : { endTick: 0, inputs: [] };
        const before = (await request('GET', `/games/${game.id}/statistics/me`)).data;
        const invalid = await put(`/games/${game.id}/plays/${invalidStart.playId}/result`, {
            playToken: invalidStart.playToken,
            validationData: empty,
        });
        const after = (await request('GET', `/games/${game.id}/statistics/me`)).data;
        check(`${game.code} 미완료 INVALID`, {
            status: invalid.status,
            result: invalid.data,
            statisticsUnchanged:
                before.validPlayCount === after.validPlayCount &&
                before.totalScore === after.totalScore,
        });
        if (invalid.data?.status !== 'INVALID' || before.validPlayCount !== after.validPlayCount)
            throw new Error('INVALID 검증 실패');
        if (game.code === 'COLOR_WORD') {
            const changed = structuredClone(validationData);
            changed.answers[0].elapsedMs = 1;
            const conflict = await put(url, {
                playToken: start.playToken,
                validationData: changed,
            });
            const hidden = await put(url, { playToken: 'incorrect-token', validationData });
            const over = await put(url, {
                playToken: start.playToken,
                validationData: {
                    answers: Array.from({ length: 10001 }, (_, i) => ({
                        sequence: i + 1,
                        answer: null,
                        elapsedMs: 3000,
                    })),
                },
            });
            check('404·409·413 실제 오류', {
                conflict: { status: conflict.status, code: conflict.code },
                hidden: { status: hidden.status, code: hidden.code },
                over: { status: over.status, code: over.code },
            });
            if (conflict.status !== 409 || hidden.status !== 404 || over.status !== 413)
                throw new Error('오류 계약 불일치');
        }
    }
}
