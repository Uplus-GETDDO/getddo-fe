import { useImageFallback } from '@shared/hooks/useImageFallback';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';

export interface ImagePreview {
    src: string;
    label: string;
}

function PreviewImage({ src, label }: ImagePreview) {
    const image = useImageFallback(src);
    if (!image.shown) {
        return (
            <div className="bg-surface-sunken text-body-sm text-fg-tertiary flex h-64 items-center justify-center rounded-lg">
                이미지를 불러오지 못했습니다
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={label}
            onError={image.onError}
            className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain"
        />
    );
}

/**
 * 이미지 크게 보기 — 목록·상세의 작은 그림을 누르면 원래 비율 그대로 크게 띄운다.
 * wide: 배너처럼 가로로 긴 그림은 모달을 넓게 연다
 */
function ImagePreviewDialog({
    preview,
    onClose,
    wide = false,
}: {
    preview: ImagePreview | null;
    onClose: () => void;
    wide?: boolean;
}) {
    return (
        <Dialog open={preview !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}>
                <DialogHeader>
                    <DialogTitle>{preview?.label}</DialogTitle>
                    <DialogDescription className="sr-only">이미지 확대 미리보기</DialogDescription>
                </DialogHeader>
                {preview && <PreviewImage src={preview.src} label={preview.label} />}
            </DialogContent>
        </Dialog>
    );
}

export { ImagePreviewDialog };
