import { useSearchParams } from 'react-router-dom';

import { ChipTabs, chipTabIds } from '@shared/ui/chip-tabs';

import { EntryHistoryPanel } from './ui/EntryHistoryPanel';
import { ParticipantsPanel } from './ui/ParticipantsPanel';

const TABS = [
    { value: 'entries', label: '응모 이력', Panel: EntryHistoryPanel },
    { value: 'participants', label: '이벤트 참여자', Panel: ParticipantsPanel },
] as const;

// AO06/AO07 — 기본 보기는 응모 이력, 참여자는 ?view=participants&eventId=…
// userId·eventId 링크 진입은 각 패널이 URL 초기값으로 읽는다
export function AdminEntriesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const active = TABS.find((tab) => tab.value === searchParams.get('view')) ?? TABS[0];
    const { tabId, panelId } = chipTabIds('admin-entries', active.value);

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* 화면 이름은 관리자 레이아웃 위쪽 바가 이미 띄운다 — 본문에서 또 적지 않고 설명만 둔다 */}
            <p className="text-body-sm text-fg-secondary">
                접수·거절된 응모 이력과 이벤트별 참여자를 조회합니다.
            </p>
            <ChipTabs
                tabs={TABS}
                value={active.value}
                onValueChange={(view) =>
                    setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        if (view === 'entries') next.delete('view');
                        else next.set('view', view);
                        return next;
                    })
                }
                label="응모 조회 보기"
                idPrefix="admin-entries"
            />
            <div id={panelId} role="tabpanel" aria-labelledby={tabId}>
                <active.Panel />
            </div>
        </div>
    );
}
