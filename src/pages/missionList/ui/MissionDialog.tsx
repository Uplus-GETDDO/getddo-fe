import { CalendarDays } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { MissionSubmissionResult } from '@entities/mission';
import type { TicketGrade } from '@entities/ticket';

import { useMissionDetail } from '@entities/mission';
import { QuizForm, SurveyForm } from '@features/submitMission';
import { useVirtualClock } from '@shared/model/virtualClock';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@shared/ui/dialog';
import { Skeleton, SkeletonText } from '@shared/ui/skeleton';
import { formatKst } from '@shared/utils/date';

import { MISSION_KIND_LABEL, missionUrgentDeadline } from '../utils/missionBoard';
import { MissionReward } from './MissionReward';

const PERIOD_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };

/** 절취선 양 끝 펀칭 구멍 반지름 — 응모권 카드(shared/ui/ticket-card)와 같은 크기 */
const PUNCH_RADIUS = 13.4;

/** 양옆 y 높이에 반원 구멍을 도려내는 마스크 — 두 원을 각각 뺀 모양을 겹친다(intersect) */
const punchMask = (y: number) =>
    [
        `radial-gradient(circle ${PUNCH_RADIUS}px at left ${y}px, transparent 98%, black 100%)`,
        `radial-gradient(circle ${PUNCH_RADIUS}px at right ${y}px, transparent 98%, black 100%)`,
    ].join(', ');

/**
 * 설문·퀴즈 풀이 모달 — 미션 목록 위에서 바로 풀고 제출한다 (멘토링: 지금 분량이면 페이지 이동보다 모달).
 * 문항 수는 관리자가 정하므로 머리(제목·기간)는 고정하고 문항 영역만 스크롤한다.
 * 이번 제출로 막 완료되면 onRewarded로 받은 응모권 수·등급을 올려 목록이 보상 모달을 띄운다.
 * 머리와 본문은 점선(절취선)으로 나누고 양 끝에 응모권처럼 펀칭 구멍을 뚫는다 — 문항이 길어 스크롤될 때 머리 아래 경계도 남는다.
 * 열 때 첫 입력칸에 포커스를 주지 않고 모달 자체에 둔다 — 서술형 칸에 바로 커서가 서거나 첫 선택지에 포커스 링이 보이지 않게
 */
export function MissionDialog({
    missionId,
    onClose,
    onRewarded,
}: {
    /** 연 미션 — null이면 닫힘 */
    missionId: string | null;
    onClose: () => void;
    onRewarded: (tickets: number, grade: TicketGrade | null) => void;
}) {
    return (
        <Dialog
            open={missionId !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                // 바탕은 안쪽 틀(MissionDialogBody)이 칠한다 — 펀칭 구멍으로 뒤가 비치도록 틀에 마스크를 건다
                className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-2xl bg-transparent p-0 ring-0 sm:max-w-xl"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    (event.currentTarget as HTMLElement | null)?.focus();
                }}
            >
                {/* 상세 조회는 미션을 열었을 때만 — 빈 id로 요청하지 않게 내용은 열린 동안에만 그린다 */}
                {missionId !== null && (
                    <MissionDialogBody
                        missionId={missionId}
                        onClose={onClose}
                        onRewarded={onRewarded}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function MissionDialogBody({
    missionId,
    onClose,
    onRewarded,
}: {
    missionId: string;
    onClose: () => void;
    onRewarded: (tickets: number, grade: TicketGrade | null) => void;
}) {
    const { data: mission, isPending } = useMissionDetail(missionId);
    // 기간 판정은 서버 몫 — 여기의 now 비교는 표시용 안내에만 쓴다 (시간 규칙)
    const now = useVirtualClock().now();
    const headerRef = useRef<HTMLElement>(null);
    const [punchY, setPunchY] = useState<number | null>(null);
    const loaded = mission !== undefined;

    // 펀칭 중심은 머리 아래 점선 높이 — 제목·설명 길이나 글자 크기 설정에 따라 바뀌어 재서 맞춘다
    useLayoutEffect(() => {
        const header = headerRef.current;
        if (!header) return;
        const measure = () => setPunchY(header.offsetHeight - 0.5);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header);
        return () => observer.disconnect();
    }, [loaded]);

    if (isPending) {
        return (
            <div className="bg-surface-elevated rounded-2xl p-6">
                {/* 모달 제목은 화면 낭독기용으로만 남기고, 화면에는 모달 꼴 스켈레톤(머리 글줄 + 문항 두 덩이)을 둔다 */}
                <DialogTitle className="sr-only">미션을 불러오는 중이에요</DialogTitle>
                <DialogDescription className="sr-only">잠시만 기다려 주세요.</DialogDescription>
                <div aria-hidden className="flex flex-col gap-3">
                    <SkeletonText className="h-6 w-14" />
                    <SkeletonText className="h-7 w-3/5" />
                    <SkeletonText className="h-5 w-4/5" />
                    <SkeletonText className="w-1/2" />
                    <div className="border-border-strong my-3 border-t border-dashed" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="mt-2 h-12 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (!mission) {
        return (
            <div className="bg-surface-elevated flex flex-col gap-2 rounded-2xl p-6">
                <DialogTitle>미션을 불러오지 못했어요</DialogTitle>
                <DialogDescription>잠시 후 다시 시도해 주세요.</DialogDescription>
            </div>
        );
    }

    const notYetOpen = now < new Date(mission.startsAt);
    const ended = now >= new Date(mission.endsAt);
    const deadline = missionUrgentDeadline(mission.endsAt, now);

    const handleCompleted = (result: MissionSubmissionResult, isNewSubmission: boolean) => {
        // 보상 모달은 이번 제출로 막 완료됐을 때(201)만 — 재제출 재생(200)은 안내만 하고 닫는다
        if (isNewSubmission) {
            onRewarded(
                result.reward?.ticketCount ?? mission.rewardTicketCount,
                result.reward?.grade ?? null,
            );
        } else {
            toast.info('이미 완료한 미션이에요.');
            onClose();
        }
    };

    return (
        <div
            className="bg-surface-elevated flex min-h-0 flex-1 flex-col rounded-2xl"
            style={
                punchY === null
                    ? undefined
                    : { maskImage: punchMask(punchY), maskComposite: 'intersect' }
            }
        >
            {/* 머리 — 종류·급한 마감 칩, 제목, 설명, 기간·문항 수·보상 한 줄. 문항이 길어도 머리는 고정된다 */}
            <header
                ref={headerRef}
                className="border-border-strong flex shrink-0 flex-col gap-2 border-b border-dashed px-6 pt-6 pr-12 pb-5"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{MISSION_KIND_LABEL[mission.missionType]}</Badge>
                    {!mission.completed && !notYetOpen && !ended && deadline && (
                        // 오늘 마감은 겟또타임 D-day처럼 검정 알약, 7일 이내는 흰 바탕+테두리 (카드와 같은 규칙)
                        <Badge variant={deadline === '오늘 마감' ? 'inverse' : 'outline'}>
                            {deadline}
                        </Badge>
                    )}
                </div>
                {/* 글자 크기는 text-xl로 — 커스텀 타이포 토큰은 공용 cn이 글자색과 같은 묶음으로 보고 지운다 */}
                <DialogTitle className="text-xl leading-7 font-semibold">
                    {mission.title}
                </DialogTitle>
                <DialogDescription className="text-sm leading-[1.375rem]">
                    {mission.description}
                </DialogDescription>
                <p className="text-caption text-fg-tertiary flex items-center gap-1">
                    <CalendarDays aria-hidden className="size-3.5" />
                    {formatKst(mission.startsAt, PERIOD_FORMAT)} ~{' '}
                    {formatKst(mission.endsAt, PERIOD_FORMAT)}
                    {mission.questions.length > 0 && ` · ${mission.questions.length}문항`}
                    <span aria-hidden>·</span>
                    <MissionReward
                        count={mission.rewardTicketCount}
                        received={mission.completed}
                        muted={mission.completed}
                        small
                    />
                </p>
            </header>
            {/* 문항이 많아도 모달 높이(화면의 85%) 안에서 문항 영역만 스크롤한다 */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5">
                {mission.completed || notYetOpen || ended ? (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <p className="text-body-bold text-fg-primary">
                            {mission.completed
                                ? '이미 완료한 미션이에요'
                                : notYetOpen
                                  ? '아직 시작하지 않은 미션이에요'
                                  : '종료된 미션이에요'}
                        </p>
                        <p className="text-body-sm text-fg-secondary">
                            {mission.completed
                                ? '미션은 한 번만 완료할 수 있어요. 다른 미션에 도전해 보세요.'
                                : notYetOpen
                                  ? `${formatKst(mission.startsAt, PERIOD_FORMAT)}부터 참여할 수 있어요.`
                                  : '운영 기간이 지나 제출할 수 없어요.'}
                        </p>
                        {/* 보상 모달과 같이 모달 너비만큼 — 짧은 버튼은 눈에 덜 띄고 누르기 어렵다 */}
                        <DialogClose asChild>
                            <Button variant="secondary" className="mt-2 w-full">
                                닫기
                            </Button>
                        </DialogClose>
                    </div>
                ) : mission.missionType === 'QUIZ' ? (
                    <QuizForm mission={mission} onCompleted={handleCompleted} />
                ) : (
                    <SurveyForm mission={mission} onCompleted={handleCompleted} />
                )}
            </div>
        </div>
    );
}
