import { Pagination } from '@shared/ui/pagination';

interface PagedFooterProps {
    page: number;
    size: number;
    totalElements: number;
    onPageChange: (page: number) => void;
}

/** 총 건수 — 표 위에 두어 몇 건인지 먼저 보고 목록을 읽는다 (관리자 목록 PagedResult와 같은 자리) */
export function PagedCount({ total }: { total: number }) {
    return (
        <p className="text-body-sm text-fg-secondary">
            총{' '}
            <span className="text-fg-primary font-semibold">{total.toLocaleString('ko-KR')}</span>건
        </p>
    );
}

// 번호형 페이지네이션 공통 푸터 — ADR-0009 (관리자 테이블은 번호형). 총 건수는 표 위 PagedCount가 맡는다
export function PagedFooter({ page, size, totalElements, onPageChange }: PagedFooterProps) {
    const totalPages = Math.max(1, Math.ceil(totalElements / size));
    return (
        <div className="flex justify-end">
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
    );
}
