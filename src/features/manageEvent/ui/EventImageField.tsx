import { ImageUp, Loader2, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { getErrorMessage } from '@shared/api/errorMessage';
import { useImageFallback } from '@shared/hooks/useImageFallback';
import { Button } from '@shared/ui/button';

import type { EventImageTarget } from '../model/imageUpload';

import { useUploadEventImage } from '../api/queries';
import { EVENT_IMAGE_ACCEPT, readImageRejection } from '../model/imageUpload';

interface EventImageFieldProps {
    label: string;
    /** 폼이 들고 있는 값 — 등록·수정(AE03·AE04)에 그대로 실린다 */
    value: string;
    onChange: (imageKey: string) => void;
    target: EventImageTarget;
    /** 수정 화면에서 이미 올라가 있던 이미지 — 키만으로는 주소를 만들 수 없어 따로 받는다 */
    initialPreviewUrl?: string | null;
}

/**
 * 이미지 키 입력을 파일 올리기로 바꾼 칸.
 *
 * 키는 서버가 저장하며 지은 이름이라 사람이 알 수가 없다. 한 장을 먼저 올려 키를 받고,
 * 그 키를 폼 값으로 넣는다 — 등록·수정 계약은 그대로 imageKey를 받는다 (BE GD-227).
 *
 * 이벤트가 아직 없는 등록 화면에서도 쓸 수 있다. 업로드는 이벤트와 무관한 별도 경로다.
 */
export function EventImageField({
    label,
    value,
    onChange,
    target,
    initialPreviewUrl,
}: EventImageFieldProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const upload = useUploadEventImage();
    // 올린 직후의 주소 — 수정 화면에서 처음 보여 줄 주소와 구분해 둔다
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [rejection, setRejection] = useState<string | null>(null);

    const previewUrl = uploadedUrl ?? (value ? initialPreviewUrl : null);
    const preview = useImageFallback(previewUrl);

    const select = (file: File | undefined) => {
        if (!file) return;
        const reason = readImageRejection(file);
        setRejection(reason);
        if (reason) return;

        upload.mutate(
            { file, target },
            {
                onSuccess: ({ imageKey, imageUrl }) => {
                    onChange(imageKey);
                    setUploadedUrl(imageUrl);
                },
            },
        );
    };

    const clear = () => {
        onChange('');
        setUploadedUrl(null);
        setRejection(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    // 업로드 실패는 서버 문구를 그대로 보여 준다 — 형식·용량 판정의 최종 근거는 서버다
    const error = rejection ?? (upload.isError ? getErrorMessage(upload.error) : null);
    const errorId = `${inputId}-error`;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-body-sm-bold text-fg-secondary">
                {label}
            </label>

            <div className="flex items-start gap-4">
                <div className="bg-surface-sunken size-20 shrink-0 overflow-hidden rounded-lg">
                    {preview.shown && (
                        <img
                            src={previewUrl!}
                            alt=""
                            onError={preview.onError}
                            className="size-full object-contain p-1"
                        />
                    )}
                </div>

                <div className="flex min-w-0 flex-col items-start gap-2">
                    <input
                        ref={inputRef}
                        id={inputId}
                        type="file"
                        accept={EVENT_IMAGE_ACCEPT}
                        className="sr-only"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        onChange={(event) => select(event.target.files?.[0])}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={upload.isPending}
                            onClick={() => inputRef.current?.click()}
                        >
                            {upload.isPending ? <Loader2 className="animate-spin" /> : <ImageUp />}
                            {upload.isPending ? '올리는 중' : value ? '다른 이미지' : '이미지 선택'}
                        </Button>
                        {value && !upload.isPending && (
                            <Button type="button" variant="ghost" size="sm" onClick={clear}>
                                <X />
                                이미지 제거
                            </Button>
                        )}
                    </div>

                    {/* 올라간 키는 등록·수정에 실리는 실제 값이라 숨기지 않고 보여 준다 */}
                    <p className="text-caption text-fg-tertiary truncate">
                        {value || 'PNG · JPG, 5MB까지'}
                    </p>
                </div>
            </div>

            {error && (
                <p id={errorId} role="alert" className="text-caption text-semantic-error-strong">
                    {error}
                </p>
            )}
        </div>
    );
}
