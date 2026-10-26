import { useContext } from 'react';
import { createPortal } from 'react-dom';

import type { DrawResult } from '@entities/drawResult';

import { cn } from '@shared/utils/cn';

import { CHIP } from '../model/chip';
import { FooterSlot } from '../model/footerSlot';

// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-6">
            <span className="text-body-sm text-fg-tertiary w-32 shrink-0 pt-0.5">{label}</span>
            <div className="text-body-sm text-fg-primary min-w-0">{children}</div>
        </div>
    );
}

/**
 * 모달 아래에 붙는 공개 줄 — 왼쪽은 지금 상태 안내, 오른쪽은 채운 기본 버튼.
 * 스크롤 영역 안에서 sticky로 붙이면 바 뒤 내용이 바 아래로 비쳐 보였다 — 모달 아래 고정 칸으로 옮긴다
 */
export function PublishBar({
    title,
    action,
    children,
}: {
    title: string;
    action: React.ReactNode;
    children: React.ReactNode;
}) {
    const slot = useContext(FooterSlot);
    const bar = (
        <section
            aria-label={title}
            className="bg-surface-page border-border-default flex flex-wrap items-center gap-x-6 gap-y-3 border-t px-6 py-4"
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="text-body-bold text-fg-primary">{title}</h3>
                <div className="text-body-sm text-fg-secondary">{children}</div>
            </div>
            {action}
        </section>
    );
    return slot ? createPortal(bar, slot) : bar;
}

export function ResultChips({ result }: { result: DrawResult }) {
    if (result.resultType === 'UNFILLED') {
        return <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>미충원</span>;
    }
    return (
        <span className="flex flex-wrap gap-1">
            {result.isCanceled ? (
                <span className={cn(CHIP, 'bg-status-rejected text-status-rejected-text')}>
                    당첨 취소
                </span>
            ) : (
                <span className={cn(CHIP, 'bg-status-approved text-status-approved-text')}>
                    당첨
                </span>
            )}
            {/* 공개 이력은 현재 명단 포함 여부와 다르다 — 취소된 결과도 공개된 적이 있으면 표시한다 */}
            <span className={cn(CHIP, 'bg-surface-sunken text-fg-secondary')}>
                {result.wasPublished ? '공개 이력 있음' : '미공개'}
            </span>
        </span>
    );
}
