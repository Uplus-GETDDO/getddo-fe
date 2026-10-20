import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * 마이페이지 카드 틀 — 제목(title-3) + 한 줄 설명(body-sm) + 오른쪽 "전체 보기" 링크.
 * 홈·미션 카드와 같은 흰 바탕·테두리·그림자에 여백 24
 */
export function SectionCard({
    title,
    description,
    moreTo,
    moreLabel,
    status,
    children,
}: {
    title: string;
    description: string;
    /** "전체 보기"가 여는 경로 — 없으면 링크를 두지 않는다 */
    moreTo?: string;
    /** 링크를 화면 낭독기에 구분해 읽힐 이름 */
    moreLabel?: string;
    /** 제목 옆 작은 갱신 표시(RefreshStatus) */
    status?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6 shadow-md">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-title-3 text-fg-primary">{title}</h2>
                        {status}
                    </div>
                    <p className="text-body-sm text-fg-tertiary">{description}</p>
                </div>
                {moreTo && (
                    <Link
                        to={moreTo}
                        aria-label={moreLabel}
                        className="text-caption text-fg-secondary hover:text-fg-primary focus-visible:ring-border-focus flex shrink-0 items-center gap-1 rounded-md py-0.5 focus-visible:ring-2 focus-visible:outline-none"
                    >
                        전체 보기
                        <ChevronRight aria-hidden className="size-5" />
                    </Link>
                )}
            </div>
            {children}
        </section>
    );
}
