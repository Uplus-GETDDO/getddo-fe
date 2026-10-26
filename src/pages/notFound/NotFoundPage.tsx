import { Link, useLocation } from 'react-router-dom';

import { TakkoRunMini } from '@features/playGame';
import { Button } from '@shared/ui/button';
import { PageStatus } from '@widgets/pageStatus';

/** 없는 주소에서 자주 가는 곳 — 막다른 길이 되지 않게 홈 말고도 이어 준다 */
const SHORTCUTS = [
    { to: '/time-raffle', label: '겟또타임' },
    { to: '/events', label: '이벤트' },
    { to: '/missions', label: '미션' },
    { to: '/my-tickets', label: '내 응모권' },
];

/**
 * 404 — 크롬 공룡처럼 'ERROR 404' 도트 글씨 아래 길바닥에서 타코야끼가 기다린다.
 * 스페이스·탭으로 바로 달릴 수 있고, 그 아래에 제목·이유 한 줄씩과 갈 곳을 둔다
 */
export function NotFoundPage() {
    // 관리자 셸 안의 404는 관리자 대시보드로 돌려보낸다 — 사용자 화면 바로가기는 관리자에게 맞지 않는다 (메뉴는 사이드바에 있다)
    const isAdmin = useLocation().pathname.startsWith('/admin');
    return (
        <main className="mx-auto w-full max-w-312">
            <PageStatus
                variant="notFound"
                art={<TakkoRunMini className="max-w-180" />}
                title="페이지를 찾을 수 없어요"
                description={
                    isAdmin
                        ? '왼쪽 메뉴에서 이어서 작업하세요.'
                        : '주소가 바뀌었거나 사라진 페이지예요.'
                }
                actions={
                    <Button asChild size="lg" className="min-w-56">
                        <Link to={isAdmin ? '/admin' : '/'}>
                            {isAdmin ? '대시보드로 가기' : '홈으로 가기'}
                        </Link>
                    </Button>
                }
                links={isAdmin ? undefined : SHORTCUTS}
            />
        </main>
    );
}
