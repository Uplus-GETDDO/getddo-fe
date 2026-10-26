import { MISSION_THUMBNAILS } from '../model/missionThumbnails';
import { missionThumbnail } from './missionThumbnail';

describe('missionThumbnail', () => {
    it('서버 그림이 있으면 그대로 쓴다', () => {
        expect(missionThumbnail({ imageUrl: '/a.png', missionType: 'QUIZ', title: '퀴즈' })).toBe(
            '/a.png',
        );
    });
    it('설문·OX 퀴즈·퀴즈 기본 그림을 고른다', () => {
        expect(missionThumbnail({ imageUrl: null, missionType: 'SURVEY', title: '설문' })).toBe(
            MISSION_THUMBNAILS.SURVEY,
        );
        expect(
            missionThumbnail({ imageUrl: null, missionType: 'QUIZ', title: '5G 상식 OX 퀴즈' }),
        ).toBe(MISSION_THUMBNAILS.OX);
        expect(
            missionThumbnail({ imageUrl: null, missionType: 'QUIZ', title: '브랜드 퀴즈' }),
        ).toBe(MISSION_THUMBNAILS.QUIZ);
    });
});
