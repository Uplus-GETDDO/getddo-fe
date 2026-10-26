import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@shared/api/client';

import type { GameSubmission } from '../api/queries';
import type { GameStart, PlayResult, ValidationData } from '../model/types';

import { useStartGamePlay, useSubmitGamePlay } from '../api/queries';
import {
    clearPendingSubmission,
    loadPendingSubmission,
    savePendingSubmission,
    snapshotSubmission,
} from '../model/gameSession';

// PROCESSING(202)일 때 같은 원본으로 서버 확정을 자동 재확인한다.
// 대기는 점증(1s→최대 5s)이고 상한을 넘으면 수동 재확인으로 넘긴다.
const AUTO_RECHECK_LIMIT = 30;
const AUTO_RECHECK_BASE_MS = 1000;
const AUTO_RECHECK_MAX_MS = 5000;

export function useGamePlaySession(gameId: string, userId: string, isUser: boolean, code?: string) {
    const key = `${userId}:${gameId}`;
    const start = useStartGamePlay();
    const { isPending: submitting, mutateAsync: submitPlay } = useSubmitGamePlay();
    const [session, setSession] = useState<GameStart | null>(null);
    const [result, setResult] = useState<PlayResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryReady, setRetryReady] = useState(true);
    const [retryAfter, setRetryAfter] = useState(0);
    const [pending, setPending] = useState<GameSubmission | undefined>(() =>
        loadPendingSubmission(key),
    );
    const busy = useRef(false);
    const autoAttempts = useRef(0);
    const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [visible, setVisible] = useState(false);
    useEffect(
        () => () => {
            if (autoTimer.current !== null) clearTimeout(autoTimer.current);
        },
        [],
    );
    useEffect(() => {
        if (retryAfter === 0) return;
        const timer = setTimeout(() => {
            setRetryReady(true);
            setRetryAfter(0);
        }, retryAfter * 1000);
        return () => clearTimeout(timer);
    }, [retryAfter]);
    const report = useCallback((failure: unknown, starting = false) => {
        if (failure instanceof ApiError) {
            const messages: Record<number, string> = {
                404: '플레이를 확인할 수 없습니다. 소유권·토큰의 세부 사유는 공개하지 않습니다.',
                409: '플레이 상태 또는 입력이 충돌했습니다. 원본 기록을 변경하지 말고 확인해 주세요.',
                413: '입력 한도를 초과했습니다. 기록을 줄여 다시 제출할 수 없습니다.',
                429: '요청이 많습니다. 잠시 후 같은 기록으로 다시 확인해 주세요.',
                403: '이 계정으로 기록·보상을 처리할 수 없습니다.',
            };
            setError(
                (starting
                    ? (
                          {
                              404: '게임을 찾을 수 없습니다.',
                              409: '현재 시작할 수 없는 게임 또는 지원하지 않는 규칙입니다.',
                              403: '이 계정으로 게임을 시작할 수 없습니다.',
                          } as Record<number, string>
                      )[failure.status]
                    : messages[failure.status]) ??
                    '서버 처리에 실패했습니다. 같은 기록으로 다시 확인해 주세요.',
            );
            if (failure.status === 429) {
                const wait = Math.max(1, failure.retryAfterSeconds ?? 1);
                setRetryReady(false);
                setRetryAfter(wait);
            }
        } else
            setError(
                failure instanceof Error
                    ? failure.message
                    : '응답을 확인하지 못했습니다. 같은 기록으로 다시 확인해 주세요.',
            );
    }, []);
    const send = useCallback(
        async (input: GameSubmission) => {
            if (busy.current || !retryReady) return;
            busy.current = true;
            setError(null);
            // finally 절은 React Compiler가 건너뛴다 — 성공·실패 양쪽에서 직접 해제한다 (GD-347)
            try {
                const receipt = await submitPlay(input);
                setResult(receipt);
                if (receipt.status !== 'PROCESSING') {
                    autoAttempts.current = 0;
                    clearPendingSubmission(key);
                    setPending(undefined);
                }
                busy.current = false;
                return {
                    ticketsGranted: receipt.reward?.ticketCount ?? 0,
                    reward: receipt.reward,
                };
            } catch (failure) {
                report(failure);
                busy.current = false;
                return;
            }
        },
        [key, report, retryReady, submitPlay],
    );
    // 서버가 확정을 미룬 PROCESSING 상태 — 같은 원본 재전송은 멱등이므로 점증 대기 후 자동으로 다시 확인한다.
    // 상한을 넘으면 수동 재확인으로 넘기고, 새 판 발급 없이 같은 playId·body를 유지한다.
    useEffect(() => {
        if (result?.status !== 'PROCESSING' || !pending) return;
        autoAttempts.current += 1;
        if (autoAttempts.current > AUTO_RECHECK_LIMIT) {
            setError('결과 처리가 오래 걸립니다. 잠시 후 원본 기록으로 다시 확인을 눌러 주세요.');
            return;
        }
        const delay = Math.min(AUTO_RECHECK_BASE_MS * autoAttempts.current, AUTO_RECHECK_MAX_MS);
        autoTimer.current = setTimeout(() => {
            autoTimer.current = null;
            void send(pending);
        }, delay);
        return () => {
            if (autoTimer.current !== null) {
                clearTimeout(autoTimer.current);
                autoTimer.current = null;
            }
        };
    }, [result, pending, send]);
    // 새로고침·재진입으로 저장소에서 되찾은 원본만 마운트 시 한 번 자동 확인한다 — 같은 기록의 PUT은 멱등이다.
    // 초기 렌더 시점의 pending만 잡아 이후 complete()가 올린 제출에는 발사하지 않는다.
    const restored = useRef<GameSubmission | undefined>(pending);
    useEffect(() => {
        const input = restored.current;
        if (!input) return;
        restored.current = undefined;
        void send(input);
    }, [send]);
    const begin = async () => {
        if (pending ?? loadPendingSubmission(key)) {
            setError(
                '이전 플레이의 결과를 먼저 확인해 주세요. 원본 기록으로 다시 확인할 수 있습니다.',
            );
            return;
        }
        if (busy.current || !retryReady) return;
        busy.current = true;
        setError(null);
        setResult(null);
        // finally 절과 try 안 throw는 React Compiler가 건너뛴다 — 시작 요청만 try로 묶고
        // 규칙 버전 불일치의 조기 거절은 try 밖에서 같은 안내로 둔다 (GD-347)
        let next: GameStart;
        try {
            next = await start.mutateAsync(gameId);
        } catch (failure) {
            busy.current = false;
            if (failure instanceof ApiError) {
                report(failure, true);
                return;
            }
            setError(
                '게임을 시작하지 못했습니다. 시작 응답 유실 시 자동으로 새 플레이를 발급하지 않습니다. 다시 시작을 눌러 주세요.',
            );
            return;
        }
        busy.current = false;
        const versions: Record<string, string> = {
            COLOR_WORD: 'color-word-v1',
            TAKKO_RUN: 'takko-run-v1',
            TAKKO_TIMING: 'takko-timing-v1',
            TAKKO_ORDER: 'takko-order-v1',
        };
        if (code && versions[code] !== next.ruleVersion) {
            setError(
                '게임을 시작하지 못했습니다. 시작 응답 유실 시 자동으로 새 플레이를 발급하지 않습니다. 다시 시작을 눌러 주세요.',
            );
            return;
        }
        setSession(next);
        setVisible(true);
    };
    const complete = async (_score: number, validationData: ValidationData) => {
        if (!session || !isUser) return;
        if (pending ?? loadPendingSubmission(key)) return;
        try {
            const input = {
                gameId,
                playId: session.playId,
                body: snapshotSubmission(session.playToken, validationData),
            };
            autoAttempts.current = 0;
            savePendingSubmission(key, input);
            setPending(input);
            return await send(input);
        } catch (failure) {
            report(failure);
        }
    };
    return {
        session,
        result,
        error,
        pending,
        retryReady,
        retryAfter,
        visible,
        busy: start.isPending || submitting,
        begin,
        recordingError: (message: string) => {
            setVisible(false);
            setError(message);
        },
        complete,
        retry: () => (pending ? send(pending) : undefined),
        exit: () => setVisible(false),
    };
}
