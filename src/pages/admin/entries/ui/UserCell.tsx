import { Link } from 'react-router-dom';

/** 사용자 칸 — 이름(사용자 조회로 가는 링크)을 진하게, ID는 아래 작은 글로. 이름이 없으면 ID가 링크가 된다 (ADR-028) */
export function UserCell({ userId, userName }: { userId: string; userName?: string | null }) {
    return (
        <>
            <Link
                className="text-body-sm-bold text-fg-primary hover:text-fg-brand hover:underline"
                to={`/admin/users?detail=${userId}`}
            >
                {userName ?? userId}
            </Link>
            {userName && <span className="text-caption text-fg-tertiary block">{userId}</span>}
        </>
    );
}
