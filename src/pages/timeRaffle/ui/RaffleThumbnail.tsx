import { useImageFallback } from '@shared/hooks/useImageFallback';
import { cn } from '@shared/utils/cn';

interface RaffleThumbnailProps {
    src: string | null | undefined;
    className?: string;
}

/**
 * 래플 상품 썸네일.
 *
 * 상품 사진은 비율이 제각각이라 object-cover로 채우면 잘린다. 바탕을 깔고 contain으로 맞춘다.
 * 칸은 기본 1:1 — 상품 카드는 정사각, 지난 결과 목록 줄은 aspect-video를 넘겨 16:9로 둔다 (DESIGN-SYSTEM '이미지 비율').
 * 크기는 너비(줄은 높이) 하나만 정해 넘긴다.
 * 상품 사진은 대개 흰 배경이라 회색 칸 위에 흰 사각형이 뜬다 — 곱하기 섞기로 흰 배경을 칸 색에 녹인다.
 * 이미지는 서버가 주는 값이라 없을 수도, 열리지 않을 수도 있다 — 둘 다 회색 칸만 둔다.
 */
export function RaffleThumbnail({ src, className }: RaffleThumbnailProps) {
    const image = useImageFallback(src);

    return (
        <div className={cn('bg-surface-sunken aspect-square shrink-0 overflow-hidden', className)}>
            {image.shown && (
                <img
                    src={src!}
                    alt=""
                    loading="lazy"
                    onError={image.onError}
                    className="size-full object-contain p-[8%] mix-blend-multiply dark:mix-blend-normal"
                />
            )}
        </div>
    );
}
