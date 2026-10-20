import { formatNumber } from '@shared/utils/format';

/**
 * 미션 보상 — 요약 줄 앞의 진한 글자 "응모권 1장" (받은 뒤 "응모권 1장 받았어요").
 * 아이콘+'+1'은 장식처럼 보이고, 카드마다 노랑 칩이면 모두 같은 강조라 눈에 띄지 않아 회색 요약 줄 안의 굵은 글자로 둔다.
 * muted: 흐린 글자(완료·종료 카드), small: 모달 정보 줄처럼 12px 줄에 맞출 때
 */
export function MissionReward({
    count,
    received = false,
    muted = false,
    small = false,
}: {
    count: number;
    received?: boolean;
    muted?: boolean;
    small?: boolean;
}) {
    return (
        <span
            className={`shrink-0 ${small ? 'text-xs leading-4.5 font-semibold' : 'text-body-sm-bold'} ${muted ? 'text-fg-tertiary' : 'text-fg-primary'}`}
        >
            응모권 {formatNumber(count)}장{received && ' 받았어요'}
        </span>
    );
}
