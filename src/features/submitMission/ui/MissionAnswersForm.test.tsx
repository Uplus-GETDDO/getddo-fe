import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MissionQuestion } from '@entities/mission';

import { MissionAnswersForm } from './MissionAnswersForm';

const questions: MissionQuestion[] = [1, 2].map((n) => ({
    id: `q${n}`,
    questionType: 'SHORT_ANSWER',
    questionText: `문항 ${n}`,
    required: true,
    displayOrder: n,
    options: [],
}));

describe('미션 부분 제출', () => {
    it('퀴즈는 답한 문항만 제출해 서버의 누적 정답 판정을 받는다', async () => {
        const submit = vi.fn();
        render(
            <MissionAnswersForm
                questions={questions}
                isPending={false}
                submitLabel="제출"
                pendingLabel="처리 중"
                variant="quiz"
                onSubmit={submit}
            />,
        );
        await userEvent.type(screen.getAllByRole('textbox')[0]!, '정답');
        await userEvent.click(screen.getByRole('button', { name: '제출' }));
        expect(submit).toHaveBeenCalledWith([{ questionId: 'q1', answerText: '정답' }]);
    });
    it('설문은 필수 문항이 비면 제출하지 않는다', async () => {
        const submit = vi.fn();
        render(
            <MissionAnswersForm
                questions={questions}
                isPending={false}
                submitLabel="제출"
                pendingLabel="처리 중"
                onSubmit={submit}
            />,
        );
        await userEvent.type(screen.getAllByRole('textbox')[0]!, '답변');
        await userEvent.click(screen.getByRole('button', { name: '제출' }));
        expect(submit).not.toHaveBeenCalled();
    });
});
