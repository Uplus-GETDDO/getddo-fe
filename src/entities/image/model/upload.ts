/**
 * 관리자 이미지 업로드 제약 — 서버와 같은 값을 쓴다 (BE GD-227 EventImageUploadService).
 *
 * 고르자마자 거르려고 화면에도 둔다. 5MB짜리를 올려 보내고 400을 받느니 바로 알려주는 편이 낫다.
 * 최종 판정은 서버가 한다 — 서버는 확장자·Content-Type에 더해 파일 머리까지 확인한다.
 */
export const IMAGE_MAX_BYTES = 5_000_000;
export const IMAGE_ACCEPT = 'image/png,image/jpeg';
export const IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;

/** 서버가 저장 경로를 가르는 값 — events/ · prizes/ 두 갈래뿐이다 */
export type ImageUploadTarget = 'EVENT' | 'PRIZE';

/**
 * 그림이 들어갈 자리. 저장 경로(ImageUploadTarget)와 따로 둔다 —
 * 배너와 이벤트 대표는 같은 events/ 밑에 저장되지만 요구 크기가 다르다.
 */
export type ImageSlot = 'BANNER' | 'EVENT' | 'PRIZE';

const SLOT_TARGET: Record<ImageSlot, ImageUploadTarget> = {
    BANNER: 'EVENT',
    EVENT: 'EVENT',
    PRIZE: 'PRIZE',
};

/** 이 자리의 그림을 서버 어디에 저장할지 */
export function uploadTargetOf(slot: ImageSlot): ImageUploadTarget {
    return SLOT_TARGET[slot];
}

/**
 * 자리마다 요구하는 그림 크기 — 가장 크게 그려지는 칸을 2배 해상도로 채울 만큼이다.
 *
 * 본문은 max-w-312(1248px)에서 멈추므로 모니터가 아무리 넓어도 칸은 더 커지지 않는다.
 * 그래서 변수는 화면 배율뿐이고, 배율 200%인 1200px 칸이 가장 나쁜 경우다 (2026-10-21 실측).
 *
 * 값은 그 자리에서 가장 큰 칸을 2배 해상도로 채울 만큼이고, 비율도 칸을 그대로 따른다 —
 * 그래야 cover로 깔아도 잘려 나가는 데가 없다 (2026-10-21 실측).
 *
 *   배너   1200×365 칸 → 2400×730 (3.3:1)
 *   대표   홈 카드 380×214 칸이 가장 크다 → 800×450 (16:9). 목록 카드 380×150도 덮는다
 *   경품   추첨 결과 카드 160px가 가장 크다 → 400×400 (1:1)
 *
 * 배너만 required다 — 홈 첫 화면을 꽉 채우는 자리라 작은 그림이 바로 눈에 띈다.
 * 나머지는 알려만 주고 올라가게 둔다. 어느 쪽이든 최종 판정은 서버 몫이다.
 */
export const IMAGE_GUIDE: Record<
    ImageSlot,
    {
        width: number;
        height: number;
        required: boolean;
        /*
         * 어느 칸에서도 살아남는 영역의 가로:세로. 같은 그림이 비율이 다른 칸에 함께 들어갈 때만 둔다.
         *
         * 칸을 꽉 채우면(cover) 가운데만 남고 가장자리가 잘린다. 이벤트 그림은 16:9 칸과
         * 1:1 칸에 같이 들어가므로, 정사각 칸 기준인 가운데 정사각형 밖은 잘릴 수 있다
         * (1:1 칸에서 좌우 44%가 잘린다, 2026-10-21 실측).
         */
        safeRatio?: number;
    }
> = {
    BANNER: { width: 2400, height: 730, required: true },
    EVENT: { width: 800, height: 450, required: false, safeRatio: 1 },
    PRIZE: { width: 400, height: 400, required: false },
};

/** 안내 문구에 쓰는 '2400×1000' 꼴 */
export function formatImageGuide(slot: ImageSlot): string {
    const { width, height } = IMAGE_GUIDE[slot];
    return `${width}×${height}`;
}

/** 고른 파일을 보내기 전에 거른다 — 통과하면 null, 아니면 사용자에게 보일 문구 */
export function readImageRejection(file: File): string | null {
    if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
        return 'PNG 또는 JPG 파일만 올릴 수 있어요.';
    }
    if (file.size > IMAGE_MAX_BYTES) {
        return `파일이 너무 커요. ${IMAGE_MAX_BYTES / 1_000_000}MB까지 올릴 수 있어요.`;
    }
    return null;
}

/** 크기 판정 결과 — blocking이면 올리지 않고 막는다 */
export interface ImageSizeIssue {
    blocking: boolean;
    message: string;
}

/**
 * 고른 그림이 자리에 비해 작은지 본다.
 *
 * 칸은 object-cover로 채우므로 가로·세로 중 더 모자란 쪽만큼 늘어난다. 그 배율로 판정한다 —
 * 긴 변만 보면 2400×300처럼 한쪽만 넉넉한 그림을 통과시켜 버린다.
 *
 * 크기를 못 읽는 경우(형식이 깨졌거나 브라우저가 거절)는 서버가 판정하게 두고 조용히 넘어간다.
 * 여기서 막는 것은 손이 빠른 길일 뿐이고, API를 직접 부르면 통과하므로 서버 검증이 따로 필요하다.
 */
export async function readImageSizeIssue(
    file: File,
    slot: ImageSlot,
): Promise<ImageSizeIssue | null> {
    if (typeof createImageBitmap !== 'function') return null;
    try {
        const bitmap = await createImageBitmap(file);
        // close() 뒤에는 width·height가 0이 되므로 닫기 전에 받아 둔다
        const { width, height } = bitmap;
        bitmap.close();
        if (width === 0 || height === 0) return null;

        const guide = IMAGE_GUIDE[slot];
        const stretch = Math.max(guide.width / width, guide.height / height);
        // 1.05까지는 눈에 띄지 않는다 — 조금 모자란 그림마다 잔소리하지 않는다
        if (stretch <= 1.05) return null;

        const size = `${width}×${height} 그림이에요.`;
        return guide.required
            ? {
                  blocking: true,
                  message: `${size} 이 자리는 ${formatImageGuide(slot)} 이상만 올릴 수 있어요.`,
              }
            : {
                  blocking: false,
                  message: `${size} ${formatImageGuide(slot)} 이상을 권합니다 — 지금은 ${stretch.toFixed(1)}배로 늘어나 흐려집니다.`,
              };
    } catch {
        return null;
    }
}
