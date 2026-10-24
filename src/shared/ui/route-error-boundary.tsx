import type { ReactNode } from 'react';

import { Component } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@shared/ui/button';

interface RouteErrorBoundaryProps {
    /** 보통 pathname — 값이 바뀌면 오류 상태를 풀고 자식을 다시 그린다 */
    resetKey: string;
    fallback: ReactNode;
    children: ReactNode;
}

interface RouteErrorBoundaryState {
    hasError: boolean;
}

/*
 * 라우트 화면의 렌더 오류를 잡는 경계 — 레이아웃(헤더·사이드바)은 살리고 Outlet 자리만 대체한다.
 * 라우트 전환이 잡히면 자동으로 복구되고, 같은 화면은 "다시 시도"가 새로고침으로 복구한다.
 */
export class RouteErrorBoundary extends Component<
    RouteErrorBoundaryProps,
    RouteErrorBoundaryState
> {
    state: RouteErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        // 오류 리포팅 도구가 없으므로 콘솔만 남긴다 — 연동 시 여기서 전송한다
        console.error('[RouteErrorBoundary]', error);
    }

    componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

/** RouteErrorBoundary의 기본 대체 화면 — 레이아웃 안에서 렌더되므로 자체 <main>을 두지 않는다 */
export function RouteErrorFallback() {
    return (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
            {/* '표시하지 못했습니다'는 고장 난 것처럼 읽혀 사용자가 할 일(연결 확인·다시 시도)로 말한다.
                주된 행동은 다시 시도라 검정 버튼, 홈은 보조 */}
            <p className="text-title-2 text-fg-primary">화면을 불러오지 못했어요</p>
            <p className="text-body-sm text-fg-tertiary">
                인터넷 연결을 확인하고 다시 시도해 주세요.
            </p>
            <div className="flex gap-2">
                <Button onClick={() => window.location.reload()}>다시 시도</Button>
                <Button asChild variant="secondary">
                    <Link to="/">홈으로</Link>
                </Button>
            </div>
        </div>
    );
}
