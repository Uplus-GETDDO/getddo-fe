import { useImageFallback } from '@shared/hooks/useImageFallback';
import { cn } from '@shared/utils/cn';

/**
 * 경품 썸네일 — 칸을 꽉 채운다. 칸은 1:1(DESIGN-SYSTEM '이미지 비율').
 *
 * 여백 없이 채우므로 칸 비율과 다른 사진은 가장자리가 잘린다. 올릴 때 권장 비율을 안내하고
 * 어긋나면 알려 주므로(entities/image) 제대로 올린 사진은 잘릴 것이 없다.
 * 이미지는 서버 값이라 없을 수도, 열리지 않을 수도 있다 — 둘 다 회색 칸만 둔다
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
            {image.shown && (
                <img
                    src={src!}
                    alt=""
                    loading="lazy"
                    onError={image.onError}
                    className="size-full object-cover"
                />
            )}
        </div>
    );
}
