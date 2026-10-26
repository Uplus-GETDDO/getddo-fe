import type { RefObject } from 'react';

import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { EntryTickets } from '@entities/entry';

import { GradeTicketTiles, TICKET_GRADE_WEIGHT, ticketGradeSchema } from '@entities/ticket';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';

interface EntryCompleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 응모한 이벤트·겟또타임 이름 */
    title: string;
    /** 이번 응모에 쓴 등급별 장수 — 생략된 등급은 0이다 */
    tickets: EntryTickets;
    /** 등급을 추첨에 반영하는가 — 반영할 때만 '브론즈 몇 장만큼'을 보인다 */
    gradeReflected: boolean;
    /** 응모 뒤 남은 전체 응모권 — 잔액을 몰랐으면 null */
    remainingBalance: number | null;
    /** 한도까지 더 쓸 수 있는 응모권 수 — 상한이 없는 이벤트는 null이다 */
    remainingAllowance: number | null;
    /** 닫은 뒤 포커스를 되돌릴 요소 — 트리거 없이 상태로 여는 모달이라 Radix가 포커스를 body로 떨어뜨린다 */
    returnFocusTo?: RefObject<HTMLElement | null>;
}

/**
 * 응모 완료 모달 — 무엇을 썼는지보다 '언제·어디서 결과를 보는지'를 알려 주는 게 목적이다.
 * 쓴 응모권·남은 응모권은 영수증처럼 회색 상자에, 발표 시각과 알림 안내는 그 아래에 둔다
 */
export function EntryCompleteDialog({
    open,
    onOpenChange,
    title,
    tickets,
    gradeReflected,
    remainingBalance,
    remainingAllowance,
    returnFocusTo,
}: EntryCompleteDialogProps) {
    const used = ticketGradeSchema.options.filter((grade) => (tickets[grade] ?? 0) > 0);
    const total = used.reduce((sum, grade) => sum + (tickets[grade] ?? 0), 0);
    const reflected = used.reduce(
        (sum, grade) => sum + (tickets[grade] ?? 0) * TICKET_GRADE_WEIGHT[grade],
        0,
    );

    const moreRule =
        total === 0
            ? null
            : remainingAllowance === null
              ? '마감 전까지 장수 제한 없이 더 응모할 수 있어요.'
              : remainingAllowance > 0
                ? `마감 전까지 ${remainingAllowance}장 더 응모할 수 있어요.`
                : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onCloseAutoFocus={(event) => {
                    if (!returnFocusTo?.current) return;
                    event.preventDefault();
                    returnFocusTo.current.focus();
                }}
                className="bg-surface-page border-border-default gap-6 rounded-2xl border p-6 shadow-md ring-0 sm:max-w-120 sm:p-8"
            >
                <DialogHeader className="gap-1 pr-8">
                    <p className="text-caption text-fg-tertiary">{title}</p>
                    {/* cn(tailwind-merge)이 text-title-3을 글자색과 겹친다고 보고 지워 16px로 줄어든다 — 안쪽 span에 문자열로 준다 */}
                    <DialogTitle className="leading-normal">
                        <span className="text-title-3 text-fg-primary block">응모했어요</span>
                    </DialogTitle>
                </DialogHeader>

                {/* 응모 확인 모달과 같은 꼴 — 쓴 등급은 등급 색 칸으로, 그 아래 절취선 뒤에 영수증처럼 적는다 */}
                {total > 0 ? (
                    <div className="flex flex-col gap-4">
                        <GradeTicketTiles
                            label="사용한 응모권"
                            items={used.map((grade) => ({ grade, count: tickets[grade] ?? 0 }))}
                        />
                        <dl className="border-border-default flex flex-col gap-2.5 border-t border-dashed pt-4">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-body-sm text-fg-secondary">사용한 응모권</dt>
                                <dd className="text-body-bold text-fg-primary tabular-nums">
                                    {total}장
                                </dd>
                            </div>
                            {gradeReflected && (
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-body-sm text-fg-secondary">추첨 반영</dt>
                                    <dd className="text-body-bold text-fg-primary tabular-nums">
                                        브론즈 {reflected}장만큼
                                    </dd>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-body-sm text-fg-secondary">남은 응모권</dt>
                                <dd className="text-body-bold text-fg-primary tabular-nums">
                                    {remainingBalance === null ? '-' : `${remainingBalance}장`}
                                </dd>
                            </div>
                        </dl>
                    </div>
                ) : (
                    <p className="text-body-sm text-fg-secondary">응모권 없이 참여했어요.</p>
                )}

                <div className="flex items-start gap-3">
                    <Bell aria-hidden className="text-fg-secondary mt-0.5 size-5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                        <p className="text-body-bold text-fg-primary">
                            {/* 발표 시각은 약속하지 않는다 — 공개는 관리자 확인 뒤다 (ADR-022) */}
                            마감 뒤 추첨하고, 확인이 끝나면 결과를 공개해요
                        </p>
                        <DialogDescription className="text-body-sm text-fg-tertiary">
                            결과가 나오면 알림으로 알려 드려요.{moreRule ? ` ${moreRule}` : ''}
                        </DialogDescription>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button asChild variant="secondary" className="flex-1">
                        <Link to="/my-entries">내 응모 내역 보기</Link>
                    </Button>
                    <DialogClose asChild>
                        <Button className="flex-1">확인</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
