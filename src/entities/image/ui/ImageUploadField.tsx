import { ImageUp, Loader2, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { getErrorMessage } from '@shared/api/errorMessage';
import { useImageFallback } from '@shared/hooks/useImageFallback';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/utils/cn';

import type { ImageSlot } from '../model/upload';

import { useUploadImage } from '../api/queries';
import {
    IMAGE_ACCEPT,
    IMAGE_GUIDE,
    formatImageGuide,
    readImageRejection,
    readImageSizeIssue,
    uploadTargetOf,
} from '../model/upload';

interface ImageUploadFieldProps {
    label: string;
    /** 폼이 들고 있는 값 — 등록·수정(AE03·AE04)에 그대로 실린다 */
    value: string;
    onChange: (imageKey: string) => void;
    /** 그림이 들어갈 자리 — 요구 크기와 저장 경로가 여기서 갈린다 */
    slot: ImageSlot;
    /** 수정 화면에서 이미 올라가 있던 이미지 — 키만으로는 주소를 만들 수 없어 따로 받는다 */
    initialPreviewUrl?: string | null;
    /** 방금 올린 이미지 주소를 바깥 미리보기에 넘긴다 — 지우면 null */
    onPreviewUrlChange?: (url: string | null) => void;
    /** stacked — 미리보기를 칸 폭 가득 위에 크게 두고 버튼을 아래로. 배너처럼 그림 자체를 확인해야 하는 자리에 쓴다 */
    layout?: 'inline' | 'stacked';
}

/**
 * 이미지 키 입력을 파일 올리기로 바꾼 칸. 이벤트·경품·배너가 함께 쓴다.
 *
 * 키는 서버가 저장하며 지은 이름이라 사람이 알 수가 없다. 한 장을 먼저 올려 키를 받고,
 * 그 키를 폼 값으로 넣는다 — 등록·수정 계약은 그대로 imageKey를 받는다 (BE GD-227).
 *
 * 대상이 아직 없는 등록 화면에서도 쓸 수 있다. 업로드는 이벤트·배너와 무관한 별도 경로다.
 */
export function ImageUploadField({
    label,
    value,
    onChange,
    slot,
    initialPreviewUrl,
    onPreviewUrlChange,
    layout = 'inline',
}: ImageUploadFieldProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const upload = useUploadImage();
    // 올린 직후의 주소 — 수정 화면에서 처음 보여 줄 주소와 구분해 둔다
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [rejection, setRejection] = useState<string | null>(null);
    // 작아서 뭉개질 그림을 알려 준다 — 막지는 않으므로 오류와 따로 둔다
    const [sizeWarning, setSizeWarning] = useState<string | null>(null);

    const guide = IMAGE_GUIDE[slot];
    const previewUrl = uploadedUrl ?? (value ? initialPreviewUrl : null);
    const preview = useImageFallback(previewUrl);

    const select = async (file: File | undefined) => {
        if (!file) return;
        const reason = readImageRejection(file);
        setRejection(reason);
        setSizeWarning(null);
        if (reason) return;

        // 막아야 하는 자리면 올리기 전에 끝낸다 — 쓰지도 못할 그림을 서버에 남기지 않는다
        const issue = await readImageSizeIssue(file, slot);
        if (issue?.blocking) {
            setRejection(issue.message);
            return;
        }
        setSizeWarning(issue?.message ?? null);

        upload.mutate(
            { file, target: uploadTargetOf(slot) },
            {
                onSuccess: ({ imageKey, imageUrl }) => {
                    onChange(imageKey);
                    setUploadedUrl(imageUrl);
                    onPreviewUrlChange?.(imageUrl);
                },
            },
        );
    };

    const clear = () => {
        onChange('');
        setUploadedUrl(null);
        onPreviewUrlChange?.(null);
        setRejection(null);
        setSizeWarning(null);
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

            <div
                className={layout === 'stacked' ? 'flex flex-col gap-3' : 'flex items-start gap-4'}
            >
                {/*
                 * 칸을 꽉 채우고 모서리는 칸을 따라 깎는다 — overflow-hidden이 둥근 틀로 잘라 준다.
                 * 칸 비율은 그 자리의 권장 비율을 그대로 쓴다. 권장대로 올리면 잘릴 것이 없고,
                 * 어긋나게 올리면 실제 화면에서 잘릴 모습이 여기서 그대로 보인다.
                 */}
                <div
                    style={{ aspectRatio: `${guide.width} / ${guide.height}` }}
                    className={cn(
                        'bg-surface-sunken relative shrink-0 overflow-hidden rounded-lg',
                        layout === 'stacked'
                            ? 'w-full'
                            : // 가로로 긴 자리는 높이를 낮춰야 폼 한 줄에 들어간다
                              guide.width / guide.height > 1.5
                              ? 'h-14'
                              : 'h-20',
                    )}
                >
                    {preview.shown && (
                        <img
                            src={previewUrl!}
                            alt=""
                            onError={preview.onError}
                            className="size-full object-cover"
                        />
                    )}
                    {/*
                     * 안전 영역 — 비율이 다른 칸에서도 끝까지 살아남는 가운데 자리.
                     * 그림을 올린 뒤에만 그린다. 빈 칸에 점선만 떠 있으면 무슨 뜻인지 알 수 없다.
                     */}
                    {guide.safeRatio != null && preview.shown && (
                        <div
                            aria-hidden
                            style={{ aspectRatio: guide.safeRatio }}
                            /*
                             * 바깥으로 아주 넓게 그림자를 뿌려 잘릴 쪽을 덮는다 — 칸이 overflow-hidden이라
                             * 칸 안에서만 보인다. 선만 긋는 것보다 어디가 날아가는지 한눈에 들어온다.
                             */
                            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 shadow-[0_0_0_9999px_rgb(from_var(--color-ink)_r_g_b/0.45)] outline-1 outline-white/70"
                        />
                    )}
                </div>

                {/* flex-1·min-w-0이라야 아래 키 글자가 줄어들 폭을 갖는다 — 없으면 글자 길이대로 늘어나 칸을 뚫는다 */}
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    <input
                        ref={inputRef}
                        id={inputId}
                        type="file"
                        accept={IMAGE_ACCEPT}
                        className="sr-only"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        onChange={(event) => void select(event.target.files?.[0])}
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

                    {/*
                     * 올라간 키는 등록·수정에 실리는 실제 값이라 숨기지 않고 보여 준다.
                     * 다만 prizes/<uuid>.png처럼 길어 한 줄을 넘기므로 폭에 맞춰 끝을 줄인다 —
                     * 전체 값은 title로 남겨 두어 마우스를 올리면 확인할 수 있다.
                     */}
                    <p
                        title={value || undefined}
                        className="text-caption text-fg-tertiary w-full truncate"
                    >
                        {value ||
                            `PNG · JPG, 5MB까지 · ${formatImageGuide(slot)} 이상${guide.required ? ' 필요' : ' 권장'}`}
                    </p>
                </div>
            </div>

            {error && (
                <p id={errorId} role="alert" className="text-caption text-semantic-error-strong">
                    {error}
                </p>
            )}
            {!error && sizeWarning && (
                <p role="status" className="text-caption text-fg-secondary">
                    {sizeWarning}
                </p>
            )}
            {/*
             * 같은 그림이 비율이 다른 칸에 함께 들어가는 자리에만 알린다 —
             * 어둡게 덮인 까닭을 글로 받쳐 주지 않으면 그림이 상한 것처럼 보인다.
             */}
            {guide.safeRatio != null && value && (
                <p className="text-caption text-fg-tertiary">
                    밝은 부분은 어디서나 보여요. 어두운 쪽은 화면에 따라 잘립니다.
                </p>
            )}
        </div>
    );
}
