import { useImageFallback } from '@shared/hooks/useImageFallback';
import { ImagePlaceholder } from '@shared/ui/image-placeholder';
import { cn } from '@shared/utils/cn';

interface RaffleThumbnailProps {
    src: string | null | undefined;
    className?: string;
}

/**
 * 래플 상품 썸네일.
 *
 * 칸을 꽉 채운다 — 권장 비율대로 올린 사진은 잘릴 것이 없고, 어긋나면 올릴 때 알려 준다.
 * 칸은 기본 1:1 — 상품 카드는 정사각, 지난 결과 목록 줄은 aspect-video를 넘겨 16:9로 둔다 (DESIGN-SYSTEM '이미지 비율').
 * 크기는 너비(줄은 높이) 하나만 정해 넘긴다.
 * 칸은 테두리 없이 옅은 회색으로 둔다 — 흰 칸은 카드 바탕과 섞여 윤곽이 사라지고, 테두리는 카드 테두리와 겹쳐 답답했다.
 * 이미지는 서버가 주는 값이라 없을 수도, 열리지 않을 수도 있다 — 둘 다 회색 칸에 빈 상태 캐릭터를 둔다.
 */
export function RaffleThumbnail({ src, className }: RaffleThumbnailProps) {
    const image = useImageFallback(src);

    return (
        <div className={cn('bg-surface-sunken aspect-square shrink-0 overflow-hidden', className)}>
            {image.shown ? (
                <img
                    src={src!}
                    alt=""
                    loading="lazy"
                    onError={image.onError}
                    className="size-full object-cover"
                />
            ) : (
                <ImagePlaceholder className="size-full" />
            )}
        </div>
    );
}
