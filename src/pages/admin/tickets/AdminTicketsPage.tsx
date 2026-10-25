import { HistoriesTab } from './HistoriesTab';

// 전체 이력(AO05) 단일 화면 — 정합성·지급·반환 탭은 GD-293에서 제거됐다.
// 기존 ?tab= 링크는 파라미터를 무시하고 전체 이력이 열리고, ?date= · ?operationType= · ?userId= 는
// HistoriesTab이 필터로 읽는다
export function AdminTicketsPage() {
    return (
        <div className="flex flex-col gap-6 pr-10 pb-10">
            <HistoriesTab />
        </div>
    );
}
