import type { ReactNode } from 'react';

import emptyTakko from '@shared/assets/mascot/empty-takko.png';
import { cn } from '@shared/utils/cn';

/**
 * 빈 상태 — 회색 선 캐릭터(피그마 image 262)와 짧은 안내. 칸 높이는 부모가 정하고, 이 블록은 그 안 가운데에 선다.
 * 목록이 비었을 때 칸을 지우지 않고 이걸 둬 화면이 들썩이지 않게 한다
 */
function EmptyState({
    title,
    description,
    action,
    size = 'md',
    className,
}: {
    title: string;
    description?: string;
    /** 다음 행동 버튼 — 예: "다른 이벤트 보기" */
    action?: ReactNode;
    /** 캐릭터 크기 — 줄 목록 사이처럼 낮은 자리는 sm */
    size?: 'sm' | 'md';
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center',
                className,
            )}
        >
            <img
                src={emptyTakko}
                alt=""
                aria-hidden
                className={size === 'sm' ? 'size-16 object-contain' : 'size-24 object-contain'}
            />
            <p className="text-body-bold text-fg-primary">{title}</p>
            {description && <p className="text-caption text-fg-tertiary">{description}</p>}
            {action}
        </div>
    );
}

export { EmptyState };
