import { useState } from 'react';

import type { TicketGrade } from '@entities/ticket';

import { TICKET_GRADE_LABEL, TICKET_GRADES } from '@entities/ticket';
import { RewardDialog } from '@features/playGame';
import { Button } from '@shared/ui/button';

/**
 * 게임 보상 모달 미리보기 — 게임을 끝까지 하지 않고 캡슐 뽑기 연출을 확인한다.
 * 실제 게임 화면과 같은 비율(840:546)의 상자 안에 띄워, 좁은 화면에서 모달이 들어가는지도 본다
 */
export function RewardDialogPreview() {
    const [grade, setGrade] = useState<TicketGrade | null>('GOLD');
    const [open, setOpen] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                {TICKET_GRADES.map((g) => (
                    <Button
                        key={g}
                        size="sm"
                        variant={grade === g ? 'primary' : 'secondary'}
                        onClick={() => setGrade(g)}
                    >
                        {TICKET_GRADE_LABEL[g]}
                    </Button>
                ))}
                <Button
                    size="sm"
                    variant={grade === null ? 'primary' : 'secondary'}
                    onClick={() => setGrade(null)}
                >
                    등급 없음
                </Button>
                <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}>
                    보상 모달 열기
                </Button>
            </div>
            {/* 게임 화면 자리 — RewardDialog는 position: relative인 부모 안에 뜬다 */}
            <div className="bg-surface-sunken border-fg-primary relative aspect-[840/546] w-full overflow-hidden rounded-2xl border-2">
                <p className="text-body-sm text-fg-tertiary absolute inset-0 flex items-center justify-center">
                    게임 화면 자리
                </p>
                <RewardDialog open={open} onOpenChange={setOpen} tickets={1} grade={grade} />
            </div>
        </div>
    );
}
