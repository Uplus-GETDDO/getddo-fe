import { summarizeTodayRewards } from './todayRewards';

describe('summarizeTodayRewards', () => {
    it('출석·게임·설문퀴즈에서 아직 받지 않은 보상 수를 센다', () => {
        const progress = summarizeTodayRewards({
            attended: false,
            games: [{ rewardedToday: true }, { rewardedToday: false }, {}],
            missions: [{ completed: true }, { completed: false }],
        });
        expect(progress.attendance).toEqual({ done: false });
        expect(progress.games).toEqual({ done: 1, total: 3 });
        expect(progress.missions).toEqual({ done: 1, total: 2 });
        expect(progress.remaining).toBe(1 + 2 + 1);
    });

    it('다 받았으면 0이고, 아직 불러오지 못한 항목은 세지 않는다', () => {
        expect(
            summarizeTodayRewards({
                attended: true,
                games: [{ rewardedToday: true }],
                missions: [],
            }).remaining,
        ).toBe(0);
        const loading = summarizeTodayRewards({
            attended: undefined,
            games: undefined,
            missions: undefined,
        });
        expect(loading.attendance).toBeUndefined();
        expect(loading.remaining).toBe(0);
    });
});
