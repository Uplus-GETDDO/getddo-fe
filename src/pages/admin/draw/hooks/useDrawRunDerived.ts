import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { DrawResult, DrawRunDetail as DrawRunDetailData } from '@entities/drawResult';

import {
    DRAWS_KEY,
    drawRunOptions,
    fetchEventDrawsPage,
    useDrawRuns,
    useEventDraws,
} from '@entities/drawResult';
import { useResultChanges } from '@entities/winner';

// 실행 목록 페이지 크기 — 이 크기를 넘는 과거 실행은 취소 원본 탐색에서 추가 페이지로 읽는다
const RUN_LIST_PAGE_SIZE = 100;

type PublicationState = 'loading' | 'after' | 'before' | 'error';

interface RosterRow {
    result: DrawResult;
    runNumber: number;
}

/**
 * AD02 실행 상세의 파생 상태 — 취소 원본의 공개 이력 판정과 최종 명단 합성.
 * 원본 결과는 이 실행에 없을 수 있어 더 이른 실행을 순차 조회해 찾는다.
 */
export function useDrawRunDerived(run: DrawRunDetailData) {
    const queryClient = useQueryClient();

    // 이벤트의 실행 목록 — 최신 실행 판정(당첨자 공개는 최신 실행으로만 요청한다, GD-199)과
    // 취소 원본 결과가 있는 더 이른 실행의 식별에 쓴다
    const { data: runList } = useEventDraws(run.eventId, { page: 1, size: RUN_LIST_PAGE_SIZE });
    const isLatestRun = runList?.items[0]?.id === run.id;
    const earlierRunIds = (runList?.items ?? [])
        .filter((r) => r.runNumber < run.runNumber)
        .map((r) => r.id);
    const earlierRuns = useDrawRuns(earlierRunIds);

    // 이 실행에 없는 취소 원본 결과 — 더 이른 실행을 뒤져 찾아야 한다
    const missingResultIds = useMemo(() => {
        const own = new Set(run.results.map((r) => r.id));
        return [...new Set(run.execution.cancellations.map((c) => c.resultId))].filter(
            (id) => !own.has(id),
        );
    }, [run]);
    // 탐색 결과는 시작한 실행에 묶는다 — 실행을 바꾸면 이전 실행의 결과가 섞이지 않는다
    const [earlierSearch, setEarlierSearch] = useState<{
        runId: string;
        results: DrawResult[];
        done: boolean;
        failed: boolean;
    }>({ runId: run.id, results: [], done: false, failed: false });
    const searchedResults = useMemo(
        () => (earlierSearch.runId === run.id ? earlierSearch.results : []),
        [earlierSearch, run.id],
    );
    const earlierSearchDone = earlierSearch.runId === run.id && earlierSearch.done;
    const earlierSearchFailed = earlierSearch.runId === run.id && earlierSearch.failed;
    const searchingRef = useRef(false);

    // 첫 페이지(최신 100개)의 상세에서 못 찾은 취소 원본은 더 이른 실행 페이지를 순차 조회해 찾는다.
    // 취소 근거에는 원본 실행 ID가 없고 resultId뿐이라 실행 상세를 하나씩 확인해야 한다
    useEffect(() => {
        if (!runList || earlierSearchDone || earlierSearchFailed || searchingRef.current) return;
        if (earlierRuns.some((q) => q.isPending)) return;
        const known = new Set(run.results.map((r) => r.id));
        for (const q of earlierRuns) for (const r of q.data?.results ?? []) known.add(r.id);
        for (const r of searchedResults) known.add(r.id);
        const remaining = new Set(missingResultIds.filter((id) => !known.has(id)));
        // 모두 찾았으면 뒤질 필요가 없다 — resultIndex가 이미 판정할 수 있다
        if (remaining.size === 0) return;
        searchingRef.current = true;
        let cancelled = false;
        const found: DrawResult[] = [];
        const runId = run.id;
        const eventId = run.eventId;
        const runNumber = run.runNumber;
        const totalPages = Math.ceil(runList.totalElements / RUN_LIST_PAGE_SIZE);
        void (async () => {
            try {
                for (let page = 2; page <= totalPages && remaining.size > 0 && !cancelled; page++) {
                    const list = await queryClient.fetchQuery({
                        queryKey: [
                            ...DRAWS_KEY,
                            'list',
                            eventId,
                            { page, size: RUN_LIST_PAGE_SIZE },
                        ],
                        queryFn: () =>
                            fetchEventDrawsPage(eventId, { page, size: RUN_LIST_PAGE_SIZE }),
                    });
                    for (const item of list.items) {
                        if (item.runNumber >= runNumber) continue;
                        const detail = await queryClient.fetchQuery(drawRunOptions(item.id));
                        if (cancelled) return;
                        for (const r of detail.results) {
                            if (remaining.delete(r.id)) found.push(r);
                        }
                        if (remaining.size === 0) break;
                    }
                }
                if (cancelled) return;
                setEarlierSearch({ runId, results: found, done: true, failed: false });
            } catch {
                if (!cancelled) {
                    setEarlierSearch({ runId, results: found, done: false, failed: true });
                }
            } finally {
                searchingRef.current = false;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        runList,
        earlierRuns,
        searchedResults,
        missingResultIds,
        earlierSearchDone,
        earlierSearchFailed,
        run,
        queryClient,
    ]);

    // 취소 근거의 resultId가 가리키는 원본 결과를 이 실행과 더 이른 실행에서 찾는다
    const resultIndex = new Map<string, DrawResult>();
    for (const other of earlierRuns) {
        for (const r of other.data?.results ?? []) resultIndex.set(r.id, r);
    }
    for (const r of searchedResults) resultIndex.set(r.id, r);
    for (const r of run.results) resultIndex.set(r.id, r);
    // 취소한 원본 결과가 공개된 적이 있는지 — 공개 후 취소·재추첨인지 공개 전인지 구분한다
    const publicationOf = (resultId: string): PublicationState => {
        const result = resultIndex.get(resultId);
        if (result) return result.wasPublished ? 'after' : 'before';
        if (earlierRuns.some((q) => q.isError) || earlierSearchFailed) return 'error';
        // 이전 실행을 끝까지 뒤졌는데도 없으면 서버 데이터 불일치다 — 갱신을 막는다
        if (earlierSearchDone) return 'error';
        return 'loading';
    };
    const publicationStates = run.execution.cancellations.map((c) => publicationOf(c.resultId));
    const anyBeforeFirstPublication = publicationStates.includes('before');
    const stillLoading = publicationStates.includes('loading');
    const publicationCheckFailed = publicationStates.includes('error');

    // 당첨자 공개 여부 — 공개 명단 변경 이력(AD07)이 하나라도 있으면 공개된 이벤트다.
    // 조회 실패는 미공개로 오판하면 안 된다 — 이미 공개된 이벤트에 당첨자 공개를 보내면 PUBLICATION-005다
    const {
        data: changePage,
        isPending: changePending,
        isError: changeError,
        refetch: refetchChanges,
    } = useResultChanges(run.eventId, {
        page: 1,
        size: 1,
    });
    const firstPublished = (changePage?.totalElements ?? 0) > 0;

    const selectedResults = run.results.filter((r) => r.resultType === 'SELECTED');
    const alreadyPublished =
        selectedResults.length > 0 && selectedResults.every((r) => r.wasPublished);
    // 공개 전에 취소된 결과가 남은 실행을 갱신하면 공개 명단에 빈 자리가 생긴다 — 취소의 재추첨 결과로 갱신한다
    const hasUnpublishedCanceledResult = selectedResults.some(
        (r) => r.isCanceled && !r.wasPublished,
    );

    // 명단이 완성인지 — 이전 실행이 전부 로드됐고 실행 목록이 한 페이지에 들어오는
    // 최신 실행을 볼 때만 참이다. 부분 자료를 최종 명단으로 표시하지 않는다 (작업 C)
    const rosterLoading = runList == null || earlierRuns.some((q) => q.isPending);
    const rosterUnreadable =
        runList != null &&
        (runList.totalElements > RUN_LIST_PAGE_SIZE || earlierRuns.some((q) => q.isError));
    const rosterComplete = !rosterLoading && !rosterUnreadable && isLatestRun === true;

    // 확정된 실행들을 회차 순으로 겹쳐 슬롯별 최종 상태를 만든다 — 공개 요청 전에 검토할 명단이다
    const rosterRows = useMemo<RosterRow[]>(() => {
        const details = [
            run,
            ...earlierRuns.map((q) => q.data).filter((r): r is DrawRunDetailData => r != null),
        ].sort((a, b) => a.runNumber - b.runNumber);
        const slots = new Map<string, { result: DrawResult; runNumber: number }>();
        for (const r of details) {
            if (r.status !== 'CONFIRMED') continue;
            for (const res of r.results) {
                slots.set(`${res.prizeId}:${res.slotNumber}`, {
                    result: res,
                    runNumber: r.runNumber,
                });
            }
        }
        return [...slots.values()].sort(
            (a, b) =>
                a.result.prizeRank - b.result.prizeRank ||
                a.result.slotNumber - b.result.slotNumber,
        );
    }, [run, earlierRuns]);
    // 공개 직전 확인 모달에 보여 줄 최종 명단 요약 — 당첨·미충원·취소 규모
    const publicationSummary = useMemo(() => {
        let winners = 0;
        let unfilled = 0;
        let canceled = 0;
        for (const { result } of rosterRows) {
            if (result.resultType === 'UNFILLED') unfilled += 1;
            else if (result.isCanceled) canceled += 1;
            else winners += 1;
        }
        return { winners, unfilled, canceled };
    }, [rosterRows]);

    // 공개 이력 판정이 실패했을 때 이전 실행 조회와 탐색 상태를 함께 되돌린다
    const retryPublicationCheck = () => {
        for (const q of earlierRuns) void q.refetch();
        setEarlierSearch({ runId: run.id, results: [], done: false, failed: false });
    };

    return {
        isLatestRun,
        publicationStates,
        anyBeforeFirstPublication,
        stillLoading,
        publicationCheckFailed,
        retryPublicationCheck,
        changePending,
        changeError,
        refetchChanges,
        firstPublished,
        alreadyPublished,
        hasUnpublishedCanceledResult,
        rosterLoading,
        rosterUnreadable,
        rosterComplete,
        rosterRows,
        publicationSummary,
    };
}
