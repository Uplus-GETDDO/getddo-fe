import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

describe('DialogContent 폭', () => {
    /*
     * 기본 grid 칸은 min-content로 커져, 줄바꿈 없는 긴 글 한 줄이 모달 상자를 벌리고
     * 안쪽 버튼을 화면 밖으로 밀어냈다(GD-344 — 배너 모달의 '등록'이 320~480px에서 사라졌다).
     * 칸을 minmax(0,1fr)로 묶어 두면 상자 폭을 넘지 못한다.
     */
    it('칸을 minmax(0,1fr)로 묶어 안쪽 내용이 상자를 벌리지 못하게 한다', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>제목</DialogTitle>
                    <DialogDescription>설명</DialogDescription>
                </DialogContent>
            </Dialog>,
        );

        expect(screen.getByRole('dialog')).toHaveClass('grid-cols-[minmax(0,1fr)]');
    });
});
