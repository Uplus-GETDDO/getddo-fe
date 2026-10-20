import { EVENT_IMAGE_MAX_BYTES, readImageRejection } from './imageUpload';

const file = (type: string, size: number) => ({ type, size, name: 'a' }) as unknown as File;

describe('readImageRejection', () => {
    it('PNG·JPG는 통과시킨다', () => {
        expect(readImageRejection(file('image/png', 100))).toBeNull();
        expect(readImageRejection(file('image/jpeg', 100))).toBeNull();
    });

    it('다른 형식은 막는다 — 서버가 PNG·JPG만 받는다', () => {
        expect(readImageRejection(file('image/webp', 100))).toMatch(/PNG 또는 JPG/);
        expect(readImageRejection(file('image/svg+xml', 100))).toMatch(/PNG 또는 JPG/);
    });

    it('상한을 넘으면 막는다 — 올려 보내고 400을 받느니 먼저 알린다', () => {
        expect(readImageRejection(file('image/png', EVENT_IMAGE_MAX_BYTES + 1))).toMatch(
            /너무 커요/,
        );
        expect(readImageRejection(file('image/png', EVENT_IMAGE_MAX_BYTES))).toBeNull();
    });
});
