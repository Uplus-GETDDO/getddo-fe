import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@shared/api/client';

import type { GameSubmission } from '../api/queries';
import type { GameStart, PlayResult, ValidationData } from '../model/types';

import { useStartGamePlay, useSubmitGamePlay } from '../api/queries';
import { snapshotSubmission } from '../model/gameSession';

// 결과가 확정되기 전에는 화면 이동 후에도 같은 사용자·게임의 원본 요청을 되찾는다. 새로고침 시에는 지워진다.
const pendingSubmissions = new Map<string, GameSubmission>();
export function useGamePlaySession(gameId: string, userId: string, isUser: boolean, code?: string) {
    const key = `${userId}:${gameId}`;
    const start = useStartGamePlay();
    const submit = useSubmitGamePlay();
    const [session, setSession] = useState<GameStart | null>(null);
    const [result, setResult] = useState<PlayResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryReady, setRetryReady] = useState(true);
    const [retryAfter, setRetryAfter] = useState(0);
    const [pending, setPending] = useState<GameSubmission | undefined>(() =>
        pendingSubmissions.get(key),
    );
    const busy = useRef(false);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (retryAfter === 0) return;
        const timer = setTimeout(() => {
            setRetryReady(true);
            setRetryAfter(0);
        }, retryAfter * 1000);
        return () => clearTimeout(timer);
    }, [retryAfter]);
    const report = (failure: unknown, starting = false) => {
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
    };
    const send = async (input: GameSubmission) => {
        if (busy.current || !retryReady) return;
        busy.current = true;
        setError(null);
        try {
            const receipt = await submit.mutateAsync(input);
            setResult(receipt);
            if (receipt.status !== 'PROCESSING') {
                pendingSubmissions.delete(key);
                setPending(undefined);
            } else {
                setRetryReady(false);
                setRetryAfter(1);
            }
            return { ticketsGranted: receipt.reward?.ticketCount ?? 0, reward: receipt.reward };
        } catch (failure) {
            report(failure);
            return;
        } finally {
            busy.current = false;
        }
    };
    const begin = async () => {
        if (busy.current || !retryReady || pendingSubmissions.has(key)) return;
        busy.current = true;
        setError(null);
        setResult(null);
        try {
            const next = await start.mutateAsync(gameId);
            const versions: Record<string, string> = {
                COLOR_WORD: 'color-word-v1',
                TAKKO_RUN: 'takko-run-v1',
                TAKKO_TIMING: 'takko-timing-v1',
                TAKKO_ORDER: 'takko-order-v1',
            };
            if (code && versions[code] !== next.ruleVersion)
                throw new Error('게임 종류와 시작 규칙 버전이 일치하지 않습니다.');
            setSession(next);
            setVisible(true);
        } catch (failure) {
            if (failure instanceof ApiError) {
                report(failure, true);
                return;
            }
            setError(
                '게임을 시작하지 못했습니다. 시작 응답 유실 시 자동으로 새 플레이를 발급하지 않습니다. 다시 시작을 눌러 주세요.',
            );
        } finally {
            busy.current = false;
        }
    };
    const complete = async (_score: number, validationData: ValidationData) => {
        if (!session || !isUser) return;
        if (pendingSubmissions.has(key)) return;
        try {
            const input = {
                gameId,
                playId: session.playId,
                body: snapshotSubmission(session.playToken, validationData),
            };
            pendingSubmissions.set(key, input);
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
        busy: start.isPending || submit.isPending,
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
