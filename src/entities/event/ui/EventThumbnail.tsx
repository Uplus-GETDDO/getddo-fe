import { cn } from '@shared/utils/cn';

/**
 * 경품 썸네일 — 비율이 제각각인 상품 사진이 잘리지 않게 회색 바탕에 contain으로 맞춘다. 칸은 1:1(DESIGN-SYSTEM '이미지 비율').
 * 흰 배경 상품 사진이 회색 칸 위에 흰 사각형으로 뜨지 않게 곱하기 섞기로 칸 색에 녹인다.
 * 이미지는 서버 값이라 없을 수 있다 — 없으면 회색 칸만 둔다
 */
export function EventThumbnail({
    src,
    className,
}: {
    src: string | null | undefined;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'bg-surface-sunken aspect-square size-12 shrink-0 overflow-hidden rounded-lg',
                className,
            )}
        >
            {src && (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="size-full object-contain p-[8%] mix-blend-multiply dark:mix-blend-normal"
                />
            )}
        </div>
    );
}
