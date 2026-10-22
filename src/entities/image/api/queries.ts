import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@shared/api/client';
import { envelopeSchema } from '@shared/api/envelopeSchema';

import type { ImageUploadTarget } from '../model/upload';

/**
 * 업로드 응답 — 등록·수정에 실을 imageKey와 미리보기에 쓸 imageUrl.
 *
 * 이름은 05-api/common.md의 「쓰기는 imageKey, 읽기는 imageUrl」 규칙을 그대로 따른다.
 * 업로드 엔드포인트 자체는 아직 spec에 없어 BE 구현에 맞춘 것이다.
 */
const imageUploadSchema = z.object({
    imageKey: z.string(),
    imageUrl: z.string(),
});

/**
 * 관리자 이미지 업로드 — 지금은 이벤트 경로 하나뿐이다.
 *
 * 배너도 같은 곳으로 올린다. 실서버가 받는 target이 EVENT·PRIZE뿐이라 BANNER를 보낼 수 없고,
 * 돌려받는 키는 어느 화면에 쓰든 그대로 통하기 때문이다 — 서버는 키 앞에 /images/만 붙인다.
 * BE가 BANNER를 열어 주면 target만 바꾸면 된다.
 */
export const IMAGE_UPLOAD_API_PATH = '/v1/admin/events/images';

/**
 * 이미지 한 장을 먼저 올리고 키를 받는다.
 *
 * 등록·수정은 그대로 imageKey를 받는다 — 올려 받은 키를 폼에 채워 보내는 구조다.
 * 그래서 대상이 아직 없는 등록 화면에서도 쓸 수 있다.
 *
 * 목록 캐시는 건드리지 않는다. 이미지를 올린 것만으로는 이벤트도 배너도 달라지지 않는다.
 */
export function useUploadImage() {
    return useMutation({
        mutationFn: async ({ file, target }: { file: File; target: ImageUploadTarget }) => {
            const body = new FormData();
            body.append('file', file);
            const { data } = await apiClient.post<unknown>(IMAGE_UPLOAD_API_PATH, body, {
                params: { target },
                // 5MB까지 받으므로 공통 10초로는 느린 회선에서 끊긴다
                timeout: 60_000,
            });
            return envelopeSchema(imageUploadSchema).parse(data).data;
        },
    });
}
