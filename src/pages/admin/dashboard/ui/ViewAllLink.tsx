import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** 칸 머리 오른쪽 '전체보기 >' — 배경 없이 글자만, 올리면 글자색이 진해진다 (대시보드 칸 공통) */
export function ViewAllLink({ to, label = '전체보기' }: { to: string; label?: string }) {
    return (
        <Link
            to={to}
            className="text-body-sm text-fg-secondary hover:text-fg-primary focus-visible:ring-border-focus inline-flex items-center gap-0.5 rounded font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
            {label}
            <ChevronRight aria-hidden className="size-4" />
        </Link>
    );
}
