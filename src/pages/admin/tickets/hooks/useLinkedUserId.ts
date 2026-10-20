import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/*
 * 사용자 상세 등 외부 링크의 ?userId= 를 탭의 적용 필터와 동기화한다.
 * 첫 렌더의 파라미터는 각 탭의 초기값이 읽으므로 여기서는 이후 변화만 전달한다 —
 * 같은 화면에서 URL의 사용자가 바뀌거나 제거되면 이전 사용자의 필터가 남지 않게 한다.
 */
export function useLinkedUserId(onChange: (userId: string | null) => void) {
    const [searchParams] = useSearchParams();
    const linked = searchParams.get('userId');
    const prev = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (prev.current === undefined || prev.current === linked) {
            prev.current = linked;
            return;
        }
        prev.current = linked;
        onChange(linked);
    }, [linked, onChange]);
}
