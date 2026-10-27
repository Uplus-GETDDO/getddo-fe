import mascotDizzy from '@shared/assets/ui/mascot-dizzy.png';

import mascotBasic from '../assets/mascot-basic.png';
import mascotBatter from '../assets/mascot-batter.png';
import mascotBonusDumpling from '../assets/mascot-bonus-dumpling.png';
import mascotBonusRiceball from '../assets/mascot-bonus-riceball.png';
import mascotBonusVegetable from '../assets/mascot-bonus-vegetable.png';
import steam from '../assets/steam.webp';
import { isStreakBonusDate, pickBonusMascotIndex } from '../utils/attendanceWeek';

/** 이미지는 캐릭터 경계에 맞춰 잘라 둔 정사각형이라, 같은 크기 상자에 넣으면 모두 가운데에 같은 크기로 보인다 */
export interface Mascot {
    src: string;
}

/** 기본 타코야끼 — 출석하면 판에 채워진다 */
export const BASIC_MASCOT: Mascot = { src: mascotBasic };

/** 반죽만 있는 타코야끼 (피그마 image 86) — 출석하지 않은 날에 옅게 깔고 그 위에 날짜를 올린다 */
export const BATTER_MASCOT: Mascot = { src: mascotBatter };

/** 김 (피그마 image 248 세 번째, 가는 김) — 아직 출석하지 않은 오늘 판에 마우스를 올리면 반죽 위로 조그맣게 피어오른다 */
export const STEAM_IMAGE = steam;

/** 어지러운 타코야끼 (피그마 image 83) — 출석판 타코야끼를 너무 많이 누르면 잠깐 보여준다 */
export const DIZZY_MASCOT: Mascot = { src: mascotDizzy };

/** 연속 출석 보상을 받은 날의 캐릭터 (피그마 image 56·58·60) */
const BONUS_MASCOTS: [Mascot, ...Mascot[]] = [
    { src: mascotBonusVegetable },
    { src: mascotBonusDumpling },
    { src: mascotBonusRiceball },
];

/** 날짜 칸에 올릴 캐릭터 — 보상을 받은 날은 보상 캐릭터, 그 외는 기본 타코야끼 */
export function getAttendanceMascot(date: string, bonusDates: ReadonlySet<string>): Mascot {
    if (!isStreakBonusDate(date, bonusDates)) return BASIC_MASCOT;
    return (
        BONUS_MASCOTS[pickBonusMascotIndex(date, bonusDates, BONUS_MASCOTS.length)] ??
        BONUS_MASCOTS[0]
    );
}
