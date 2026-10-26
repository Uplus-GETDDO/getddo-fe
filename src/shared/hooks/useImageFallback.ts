import { useState } from 'react';

/**
 * 서버가 준 이미지 주소가 깨졌을 때 대체 칸으로 떨어뜨린다.
 *
 * 주소는 서버 값이라 없을 수도, 있어도 열리지 않을 수도 있다. 그냥 두면 브라우저가
 * 깨진 이미지 아이콘을 그려 화면에 그대로 노출된다 — 실서버에 한글이 인코딩된 경로가 섞여 있어
 * 실제로 일어나는 일이다. 주소가 없을 때와 같은 회색 칸으로 보내 두 경우를 한 모양으로 만든다.
 *
 * 실패한 주소를 기억한다 — 참·거짓으로 들고 있으면 주소가 바뀌어도 깨진 상태가 남아
 * 다음 이미지까지 안 그린다. 주소가 바뀌면 저절로 다시 시도한다.
 *
 * 반환한 onError를 img에 걸고, shown이 참일 때만 img를 그린다.
 */
export function useImageFallback(src: string | null | undefined) {
    const [failed, setFailed] = useState<string | null>(null);

    return {
        shown: Boolean(src) && failed !== src,
        onError: () => setFailed(src ?? null),
    };
}
