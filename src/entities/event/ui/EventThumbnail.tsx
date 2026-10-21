import { useImageFallback } from '@shared/hooks/useImageFallback';
import { ImagePlaceholder } from '@shared/ui/image-placeholder';
import { cn } from '@shared/utils/cn';

/**
 * 경품 썸네일 — 비율이 제각각인 상품 사진이 잘리지 않게 칸에 contain으로 맞춘다. 칸은 1:1(DESIGN-SYSTEM '이미지 비율').
 * 칸은 테두리 없이 옅은 회색으로 둔다 — 흰 칸은 카드 바탕과 섞여 윤곽이 사라지고, 테두리는 카드 테두리와 겹쳐 답답했다.
 * 흰 배경 상품 사진은 곱하기 섞기로 칸 색에 녹여 흰 사각형이 뜨지 않게 하고, 여백을 줄여 상품을 크게 보인다.
 * 이미지는 서버 값이라 없을 수도, 열리지 않을 수도 있다 — 둘 다 회색 칸에 빈 상태 캐릭터를 둔다
 */
export function EventThumbnail({
    src,
    className,
}: {
    src: string | null | undefined;
    className?: string;
}) {
    const image = useImageFallback(src);

    return (
        <div
            className={cn(
                'bg-surface-sunken aspect-square size-12 shrink-0 overflow-hidden rounded-lg',
                className,
            )}
        >
            {image.shown ? (
                <img
                    src={src!}
                    alt=""
                    loading="lazy"
                    onError={image.onError}
                    className="size-full object-contain p-[4%] mix-blend-multiply dark:mix-blend-normal"
                />
            ) : (
                <ImagePlaceholder className="size-full" />
            )}
        </div>
    );
}
