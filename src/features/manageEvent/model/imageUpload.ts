/**
 * 이벤트·경품 이미지 업로드 제약 — 서버와 같은 값을 쓴다 (BE GD-227 EventImageUploadService).
 *
 * 고르자마자 거르려고 화면에도 둔다. 5MB짜리를 올려 보내고 400을 받느니 바로 알려주는 편이 낫다.
 * 최종 판정은 서버가 한다 — 서버는 확장자·Content-Type에 더해 파일 머리까지 확인한다.
 */
export const EVENT_IMAGE_MAX_BYTES = 5_000_000;
export const EVENT_IMAGE_ACCEPT = 'image/png,image/jpeg';
export const EVENT_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const;

/** 업로드할 자리 — 서버가 이 값으로 저장 경로를 가른다 (events/ · prizes/) */
export type EventImageTarget = 'EVENT' | 'PRIZE';

/** 고른 파일을 보내기 전에 거른다 — 통과하면 null, 아니면 사용자에게 보일 문구 */
export function readImageRejection(file: File): string | null {
    if (!EVENT_IMAGE_TYPES.includes(file.type as (typeof EVENT_IMAGE_TYPES)[number])) {
        return 'PNG 또는 JPG 파일만 올릴 수 있어요.';
    }
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
        return `파일이 너무 커요. ${EVENT_IMAGE_MAX_BYTES / 1_000_000}MB까지 올릴 수 있어요.`;
    }
    return null;
}
