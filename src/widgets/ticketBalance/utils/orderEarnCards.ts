/** 순서를 정하는 데 필요한 값만 — 카드 모양과 상관없이 테스트할 수 있게 한다 */
export interface OrderableEarnCard {
    category: 'ATTENDANCE' | 'MISSION' | 'GAME';
    rewardTickets: number;
    completed: boolean;
}

/**
 * 홈 '오늘 받을 수 있는 응모권' 카드 순서.
 *
 * 1. 출석 — 하루 한 번 바로 받는 보상이라 맨 앞
 * 2. 아직 안 한 미션·게임을 번갈아 — 종류별로 몰아 두면 게임이 오른쪽 끝에 묻혀 넘겨 봐야만 보였다.
 *    같은 종류 안에서는 받는 응모권이 많은 순
 * 3. 오늘 다 한 카드(출석 포함)는 맨 뒤 — 원래 순서를 지킨다
 *
 * 무작위로 섞지 않는다 — 들어올 때마다 자리가 바뀌면 보던 카드를 다시 찾기 어렵다
 */
export function orderEarnCards<T extends OrderableEarnCard>(cards: T[]): T[] {
    const open = cards.filter((card) => !card.completed);
    const done = cards.filter((card) => card.completed);
    // sort는 같은 값끼리 원래 순서를 지킨다 — 장수가 같으면 서버가 준 순서 그대로
    const byReward = (category: OrderableEarnCard['category']) =>
        open
            .filter((card) => card.category === category)
            .sort((a, b) => b.rewardTickets - a.rewardTickets);

    const missions = byReward('MISSION');
    const games = byReward('GAME');
    const alternated: T[] = [];
    for (let i = 0; i < Math.max(missions.length, games.length); i += 1) {
        const mission = missions.at(i);
        const game = games.at(i);
        if (mission) alternated.push(mission);
        if (game) alternated.push(game);
    }

    return [...open.filter((card) => card.category === 'ATTENDANCE'), ...alternated, ...done];
}
