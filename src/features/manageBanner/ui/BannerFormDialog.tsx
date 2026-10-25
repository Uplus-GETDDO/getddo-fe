import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import type { AdminBanner } from '@entities/banner';

import { BANNER_IMAGE_KEY_MAX_LENGTH } from '@entities/banner';
import { AdminEventPicker } from '@entities/event';
import { ImageUploadField } from '@entities/image';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog';

import { useCreateBanner, useUpdateBanner } from '../api/queries';

const bannerFormSchema = z.object({
    eventId: z.string().min(1, '연결할 이벤트를 선택하세요'),
    imageKey: z
        .string()
        .trim()
        .min(1, '배너 이미지를 올려주세요')
        .max(
            BANNER_IMAGE_KEY_MAX_LENGTH,
            `이미지 키는 ${BANNER_IMAGE_KEY_MAX_LENGTH}자 이하입니다`,
        ),
});

type BannerFormValues = z.infer<typeof bannerFormSchema>;

export interface BannerEventOption {
    id: string;
    title: string;
}

interface BannerFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 수정 대상 — 없으면 등록이다 */
    banner: AdminBanner | null;
    /** 현재 전체 목록 기준 1기반 위치 — 등록은 맨 뒤, 수정은 현재 위치다 */
    displayOrder: number;
}

function BannerForm({
    banner,
    displayOrder,
    onDone,
}: Omit<BannerFormDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
    const isEdit = banner !== null;
    const createBanner = useCreateBanner();
    const updateBanner = useUpdateBanner();
    const mutation = isEdit ? updateBanner : createBanner;

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<BannerFormValues>({
        resolver: zodResolver(bannerFormSchema),
        defaultValues: { eventId: banner?.eventId ?? '', imageKey: banner?.imageKey ?? '' },
    });

    const onSubmit = handleSubmit((values) => {
        const body = {
            eventId: values.eventId,
            imageKey: values.imageKey,
            displayOrder,
        };
        const options = {
            onSuccess: () => {
                toast.success(isEdit ? '배너를 수정했습니다' : '배너를 등록했습니다');
                onDone();
            },
        };
        if (banner) updateBanner.mutate({ bannerId: banner.id, body }, options);
        else createBanner.mutate(body, options);
    });

    return (
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-2">
                <span className="text-body-bold text-fg-primary">연결 이벤트</span>
                {/*
                 * 이벤트가 수천 건이 되면 셀렉트 하나에 다 늘어놓을 수 없다 — 최근 등록한 이벤트를 먼저 보이고,
                 * 이름을 치면 서버에서 찾는다(AE01 keyword). 다른 화면에서 복사한 이벤트 ID를 붙여 넣어도 된다
                 */}
                <Controller
                    control={control}
                    name="eventId"
                    render={({ field }) => (
                        <AdminEventPicker
                            eventId={field.value}
                            onChange={field.onChange}
                            label="연결 이벤트"
                            suggest
                        />
                    )}
                />
                {errors.eventId && (
                    <p role="alert" className="text-semantic-error-strong text-caption">
                        {errors.eventId.message}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2">
                {/*
                 * 배너 전용 업로드 경로가 없어 이벤트 쪽으로 올린다 — 실서버 target은 EVENT·PRIZE뿐이다.
                 * 받은 키는 어디에 쓰든 통한다. 서버가 키 앞에 /images/만 붙이기 때문이다.
                 */}
                <Controller
                    control={control}
                    name="imageKey"
                    render={({ field }) => (
                        <ImageUploadField
                            label="배너 이미지"
                            slot="BANNER"
                            layout="stacked"
                            value={field.value}
                            onChange={field.onChange}
                            initialPreviewUrl={banner?.imageUrl}
                        />
                    )}
                />
                {errors.imageKey && (
                    <p
                        id="banner-image-key-error"
                        className="text-semantic-error-strong text-caption"
                    >
                        {errors.imageKey.message}
                    </p>
                )}
            </div>

            {mutation.isError && (
                <p role="alert" className="text-semantic-error-strong text-body-sm">
                    {getErrorMessage(
                        mutation.error,
                        `배너를 ${isEdit ? '수정' : '등록'}하지 못했습니다. 다시 시도해주세요.`,
                    )}
                </p>
            )}

            <div className="flex gap-4">
                <DialogClose asChild>
                    <Button variant="secondary" type="button" className="h-10 flex-1">
                        취소
                    </Button>
                </DialogClose>
                <Button type="submit" className="h-10 flex-1" disabled={mutation.isPending}>
                    {mutation.isPending ? '저장 중…' : isEdit ? '수정' : '등록'}
                </Button>
            </div>
        </form>
    );
}

/** 배너 등록·수정 다이얼로그 — 열릴 때마다 폼이 새로 마운트되어 입력값과 오류가 초기화된다 */
export function BannerFormDialog({
    open,
    onOpenChange,
    banner,
    displayOrder,
}: BannerFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="bg-surface-page border-border-default gap-6 rounded-2xl border p-8 shadow-md ring-0 sm:max-w-140"
            >
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-title-3 text-fg-primary">
                        {banner ? '배너 수정' : '배너 등록'}
                    </DialogTitle>
                    <DialogDescription className="text-body-sm text-fg-secondary">
                        배너를 선택하면 연결한 이벤트 화면으로 이동합니다.
                    </DialogDescription>
                </DialogHeader>
                <BannerForm
                    banner={banner}
                    displayOrder={displayOrder}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
