import { afterEach, describe, expect, it, vi } from 'vitest';

import { IMAGE_GUIDE, IMAGE_MAX_BYTES, readImageRejection, readImageSizeIssue } from './upload';

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
        expect(readImageRejection(file('image/png', IMAGE_MAX_BYTES + 1))).toMatch(/너무 커요/);
        expect(readImageRejection(file('image/png', IMAGE_MAX_BYTES))).toBeNull();
    });
});

describe('readImageSizeIssue', () => {
    /* 실제 ImageBitmap은 close() 뒤 크기가 0이 된다 — 그 성질까지 흉내 낸다 */
    function stubBitmap(width: number, height: number) {
        // 부를 때마다 새로 만든다 — 한 번 닫힌 것을 돌려주면 두 번째 판정이 0×0이 된다
        vi.stubGlobal('createImageBitmap', () => {
            const bitmap = {
                width,
                height,
                close() {
                    bitmap.width = 0;
                    bitmap.height = 0;
                },
            };
            return Promise.resolve(bitmap);
        });
    }

    afterEach(() => vi.unstubAllGlobals());

    it('권장 크기를 채우면 아무 말도 하지 않는다', async () => {
        stubBitmap(IMAGE_GUIDE.BANNER.width, IMAGE_GUIDE.BANNER.height);
        await expect(readImageSizeIssue(file('image/png', 100), 'BANNER')).resolves.toBeNull();
    });

    /* 경품 칸은 배너보다 작아 같은 그림도 통과한다 — 자리마다 기준이 다르다 */
    it('자리에 따라 판정이 갈린다', async () => {
        stubBitmap(900, 900);
        await expect(readImageSizeIssue(file('image/png', 100), 'PRIZE')).resolves.toBeNull();
        await expect(readImageSizeIssue(file('image/png', 100), 'BANNER')).resolves.toEqual({
            blocking: true,
            message: '900×900 그림이에요. 이 자리는 2400×730 이상만 올릴 수 있어요.',
        });
    });

    /*
     * 한쪽만 넉넉한 그림을 통과시키면 안 된다 — cover는 모자란 쪽에 맞춰 늘린다.
     * 2400×300은 가로는 충분해도 세로가 3.3배 늘어난다.
     */
    it('가로만 넉넉해도 세로가 모자라면 알려 준다', async () => {
        stubBitmap(2400, 300);
        await expect(readImageSizeIssue(file('image/png', 100), 'BANNER')).resolves.toMatchObject({
            blocking: true,
        });
    });

    it('작으면 실제 크기와 늘어나는 배율을 알려 준다 — 닫은 뒤의 0이 아니라', async () => {
        stubBitmap(400, 400);
        await expect(readImageSizeIssue(file('image/png', 100), 'EVENT')).resolves.toEqual({
            blocking: false,
            message:
                '400×400 그림이에요. 800×450 이상을 권합니다 — 지금은 2.0배로 늘어나 흐려집니다.',
        });
    });

    it('크기를 못 읽으면 조용히 넘어간다 — 최종 판정은 서버다', async () => {
        vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('깨진 파일')));
        await expect(readImageSizeIssue(file('image/png', 100), 'EVENT')).resolves.toBeNull();
    });
});
