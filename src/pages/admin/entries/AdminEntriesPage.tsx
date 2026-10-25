import { useSearchParams } from 'react-router-dom';

import { EntryHistoryPanel } from './ui/EntryHistoryPanel';
import { ParticipantsPanel } from './ui/ParticipantsPanel';

// AO06/AO07 — 기본 보기는 응모 이력, 참여자는 ?view=participants&eventId=…
// 참여자는 한 이벤트에 딸린 목록이라 탭으로 나란히 두지 않는다 — 이벤트 상세·대시보드·응모 이력의
// '참여자 보기' 링크로만 들어온다. 두 탭이 같은 무게로 놓이면 무엇이 다른지 헷갈렸다
// userId·eventId 링크 진입은 각 패널이 URL 초기값으로 읽는다
export function AdminEntriesPage() {
    const [searchParams] = useSearchParams();
    const participants = searchParams.get('view') === 'participants';

    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            {participants ? <ParticipantsPanel /> : <EntryHistoryPanel />}
        </div>
    );
}
