import { useEffect, useState } from 'react';

/** 그림 안에서 실제 내용이 있는 영역 — 그림 크기에 대한 비율(0~1) */
export interface ContentBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/** 재는 데 쓸 축소 크기 — 비율만 알면 되므로 작게 그려 빨리 끝낸다 */
const SAMPLE = 160;

/** 투명하거나 거의 흰 점은 빈 곳으로 본다 — 투명 PNG와 흰 바탕 사진을 같이 다룬다 */
function isEmpty(r: number, g: number, b: number, a: number) {
    return a < 16 || (r > 245 && g > 245 && b > 245);
}

/** 그림의 빈 여백을 뺀 내용 영역을 잰다. 다른 출처 그림이 CORS를 막으면 잴 수 없어 null */
export function measureContentBox(image: HTMLImageElement): ContentBox | null {
    const scale = SAMPLE / Math.max(image.naturalWidth, image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    let data: Uint8ClampedArray;
    try {
        data = context.getImageData(0, 0, width, height).data;
    } catch {
        return null;
    }
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            if (isEmpty(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
    }
    if (right < 0) return null;
    return {
        left: left / width,
        top: top / height,
        right: (right + 1) / width,
        bottom: (bottom + 1) / height,
    };
}

/** 이 이상 키우지 않는다 — 작은 그림이 흐려지지 않게 */
const MAX_ZOOM = 1.6;

/**
 * 정사각형 칸에 object-contain으로 넣은 그림을, 여백을 뺀 내용이 칸 가운데에 꽉 차게 옮기는 transform.
 * 상품 사진마다 여백이 달라 어떤 건 아래로 쏠려 보였다
 */
export function centerContentTransform(
    box: ContentBox,
    naturalWidth: number,
    naturalHeight: number,
): string {
    const fit = 1 / Math.max(naturalWidth, naturalHeight);
    // 칸 크기를 1로 둔 좌표 — 내용 가운데가 칸 가운데에서 얼마나 떨어졌는지
    const dx = ((box.left + box.right) / 2 - 0.5) * naturalWidth * fit;
    const dy = ((box.top + box.bottom) / 2 - 0.5) * naturalHeight * fit;
    const contentSize = Math.max(
        (box.right - box.left) * naturalWidth * fit,
        (box.bottom - box.top) * naturalHeight * fit,
    );
    const zoom = Math.min(MAX_ZOOM, 1 / contentSize);
    return `scale(${zoom}) translate(${-dx * 100}%, ${-dy * 100}%)`;
}

/** 그림을 받아 내용 영역을 재고 가운데 맞춤 transform을 돌려준다 — 재기 전·잴 수 없으면 undefined */
export function useCenteredImage(src: string | null | undefined): string | undefined {
    const [result, setResult] = useState<{ src: string; transform: string | undefined } | null>(
        null,
    );
    useEffect(() => {
        if (!src) return;
        let cancelled = false;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            if (cancelled) return;
            const box = measureContentBox(image);
            setResult({
                src,
                transform: box
                    ? centerContentTransform(box, image.naturalWidth, image.naturalHeight)
                    : undefined,
            });
        };
        image.src = src;
        return () => {
            cancelled = true;
        };
    }, [src]);
    return result && result.src === src ? result.transform : undefined;
}
