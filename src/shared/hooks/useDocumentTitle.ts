import { useEffect } from 'react';

/** index.html이 들고 있는 기본 제목 — 화면 이름을 모를 때로 되돌아간다 */
export const BASE_DOCUMENT_TITLE = 'GETDDO — LG유플러스 응모 이벤트 플랫폼';

/**
 * 브라우저 탭 제목에 지금 화면 이름을 붙인다.
 *
 * 전에는 모든 화면이 index.html의 한 줄을 그대로 썼다. 탭을 여러 개 띄우면 어느 쪽이
 * 무엇인지 구분할 수 없고, 방문 기록·북마크도 전부 같은 이름으로 남았다.
 *
 * 이름이 없으면(아직 못 불러왔거나 홈처럼 이름을 붙일 필요가 없으면) 기본 제목으로 둔다.
 */
export function useDocumentTitle(name: string | undefined) {
    useEffect(() => {
        document.title = name ? `${name} · GETDDO` : BASE_DOCUMENT_TITLE;
    }, [name]);
}
