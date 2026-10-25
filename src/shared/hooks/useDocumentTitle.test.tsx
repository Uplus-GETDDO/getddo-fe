import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BASE_DOCUMENT_TITLE, useDocumentTitle } from './useDocumentTitle';

afterEach(() => {
    document.title = BASE_DOCUMENT_TITLE;
});

describe('useDocumentTitle', () => {
    it('화면 이름을 탭 제목 앞에 붙인다', () => {
        renderHook(() => useDocumentTitle('내 응모 내역'));
        expect(document.title).toBe('내 응모 내역 · GETDDO');
    });

    // 아직 못 불러왔거나 이름을 붙일 필요가 없는 화면(홈)은 기본 제목으로 둔다
    it('이름이 없으면 기본 제목으로 돌아간다', () => {
        const { rerender } = renderHook<void, { name: string | undefined }>(
            ({ name }) => useDocumentTitle(name),
            { initialProps: { name: '이벤트' } },
        );
        expect(document.title).toBe('이벤트 · GETDDO');

        rerender({ name: undefined });
        expect(document.title).toBe(BASE_DOCUMENT_TITLE);
    });
});
