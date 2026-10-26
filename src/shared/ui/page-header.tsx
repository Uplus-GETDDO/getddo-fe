import { ChevronLeft } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

/**
 * 하위 페이지 머리 — 위로 돌아가는 작은 링크 + 페이지 제목(title-2) + 한 줄 설명, 오른쪽에 보조 동작.
 * 마이페이지의 "전체 보기"가 여는 페이지(내 응모 내역·내 응모권)에서 쓴다
 */
function PageHeader({
    backTo,
    backLabel,
    title,
    description,
    action,
}: {
    backTo: string;
    backLabel: string;
    title: string;
    /** 한 줄 설명 — 제목만으로 충분하면 생략한다 */
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
                <Link
                    to={backTo}
                    // 글줄(22px) 위아래로 패딩을 넓혀 누름 칸이 WCAG 2.5.8의 24px를 넘기고 음수 마진으로 줄간격을 지킨다
                    className="text-body-sm text-fg-secondary hover:text-fg-primary focus-visible:ring-border-focus -my-0.5 flex w-fit items-center gap-0.5 rounded-md py-0.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                    <ChevronLeft aria-hidden className="size-4" />
                    {backLabel}
                </Link>
                <div className="flex flex-col gap-2">
                    <h1 className="text-title-2 text-fg-primary">{title}</h1>
                    {description && <p className="text-body-sm text-fg-secondary">{description}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

export { PageHeader };
