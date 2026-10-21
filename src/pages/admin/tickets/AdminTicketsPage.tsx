import { useSearchParams } from 'react-router-dom';

import { ChipTabs, chipTabIds } from '@shared/ui/chip-tabs';

import { GrantsTab } from './GrantsTab';
import { HistoriesTab } from './HistoriesTab';
import { InconsistencyTab } from './InconsistencyTab';
import { RefundsTab } from './RefundsTab';

const TABS = [
    { value: 'consistency', label: '정합성', Panel: InconsistencyTab },
    { value: 'grants', label: '지급 이력', Panel: GrantsTab },
    { value: 'histories', label: '전체 이력', Panel: HistoriesTab },
    { value: 'refunds', label: '반환 이력', Panel: RefundsTab },
] as const;

// 한 페이지 안의 탭 4개 — 정합성(AO09·AO04)이 기본이고 나머지는 보조 목록(AO03·AO05·AO08)이다.
// 선택한 탭은 ?tab= 에 두어 새로고침·링크 공유에서도 유지한다
export function AdminTicketsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const active = TABS.find((tab) => tab.value === searchParams.get('tab')) ?? TABS[0];
    const { tabId, panelId } = chipTabIds('tickets', active.value);

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* '응모권 관리' 설명 기본안 — 이 화면이 하는 일을 한 줄로 말해 준다 */}
            <p className="text-body-sm text-fg-secondary">
                응모권 지급·사용 내역과 잔액 정합성을 확인합니다.
            </p>
            <ChipTabs
                tabs={TABS}
                value={active.value}
                onValueChange={(tab) =>
                    setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('tab', tab);
                        return next;
                    })
                }
                label="응모권 관리"
                idPrefix="tickets"
            />
            <div id={panelId} role="tabpanel" aria-labelledby={tabId}>
                <active.Panel />
            </div>
        </div>
    );
}
