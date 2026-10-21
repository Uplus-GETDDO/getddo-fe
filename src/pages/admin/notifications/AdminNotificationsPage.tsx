import { useSearchParams } from 'react-router-dom';

import { ChipTabs, chipTabIds } from '@shared/ui/chip-tabs';

import { DeliveriesTab } from './DeliveriesTab';
import { JobsTab } from './JobsTab';

const TABS = [
    { value: 'jobs', label: '알림 작업', Panel: JobsTab },
    { value: 'deliveries', label: '발송 이력', Panel: DeliveriesTab },
] as const;

// 관리자 알림 운영 — 생성 작업(AN01~AN03)이 기본이고 개별 발송 이력(AN04·AN05)은 보조다.
// 선택한 탭은 ?tab= 에 두어 새로고침·링크 공유에서도 유지한다
export function AdminNotificationsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const active = TABS.find((tab) => tab.value === searchParams.get('tab')) ?? TABS[0];
    const { tabId, panelId } = chipTabIds('notifications', active.value);

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {/* '알림 관리' 설명 기본안 — 이 화면이 하는 일을 한 줄로 말해 준다 */}
            <p className="text-body-sm text-fg-secondary">
                알림 발송 상태와 실패 내역을 확인합니다.
            </p>
            <ChipTabs
                tabs={TABS}
                value={active.value}
                onValueChange={(tab) => setSearchParams({ tab })}
                label="알림 운영"
                idPrefix="notifications"
            />
            <div id={panelId} role="tabpanel" aria-labelledby={tabId}>
                <active.Panel />
            </div>
        </div>
    );
}
