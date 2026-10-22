import { http } from 'msw';

import { BANNER_MAX_COUNT } from '@entities/banner';
import { env } from '@shared/config/env';

import { mockNow } from '../now';
import { mockAdminEventIsCanceled, resolveMockImageUrl } from './adminEvent';
import { findMockEvent } from './event';
import { fail, ok } from './response';

const api = (path: string) => `${env.apiBaseUrl}${path}`;

/** 목업 배너 항목 — AdminBanner(spec AB01) 응답 필드와 같다. imageUrl은 imageKey에서 파생한다 */
interface MockBanner {
    id: string;
    eventId: string | null;
    imageKey: string;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

/*
 * 올려 둔 그림이 있으면 그것을 돌려주고, 없으면 키를 새긴 자리표시자를 만든다.
 *
 * 씨앗 배너의 키(banners/weekly-buds.png 등)는 실제 파일이 없어 자리표시자가 맞다.
 * 그러나 관리자가 올린 그림까지 덮어 버리면 바꿔도 홈 화면이 그대로여서, 올린 것을 먼저 본다.
 *
 * 자리표시자는 배너 템플릿(1200×365)을 따라 왼쪽 55%를 글 자리로 비우고
 * 오른쪽 그림 자리에만 키를 작게 적는다 — 위에 얹는 이벤트 글과 겹치지 않게.
 */
function imageUrlOf(imageKey: string) {
    const uploaded = resolveMockImageUrl(imageKey);
    if (uploaded) return uploaded;

    const label = imageKey.slice(0, 40).replace(/[<>&"]/g, '');
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="365">' +
        '<rect width="1200" height="365" fill="#f3f4f6"/>' +
        '<rect x="660" width="540" height="365" fill="#e5e7eb"/>' +
        `<text x="930" y="190" font-size="20" text-anchor="middle" fill="#6b7280">${label}</text>` +
        '</svg>';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const seedAt = '2026-10-01T00:00:00.000Z';

const mockBanners: MockBanner[] = [
    {
        id: 'bnr-1',
        eventId: 'evt-001',
        imageKey: 'banners/weekly-buds.png',
        displayOrder: 1,
        createdAt: seedAt,
        updatedAt: seedAt,
    },
    {
        id: 'bnr-2',
        eventId: 'evt-002',
        imageKey: 'banners/attendance-challenge.png',
        displayOrder: 2,
        createdAt: seedAt,
        updatedAt: seedAt,
    },
    {
        id: 'bnr-3',
        eventId: 'evt-005',
        imageKey: 'banners/starbucks-ecard.png',
        displayOrder: 3,
        createdAt: seedAt,
        updatedAt: seedAt,
    },
];

// 노출 순서는 displayOrder ASC, id ASC (spec B01 채택)
const sorted = () =>
    [...mockBanners].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));

const toAdminResponse = (item: MockBanner) => ({ ...item, imageUrl: imageUrlOf(item.imageKey) });

/** 관리 변경 뒤 상대 순서를 유지하면서 1~N으로 정리한다. */
function applyOrder(items: MockBanner[], at: string) {
    items.forEach((item, index) => {
        if (item.displayOrder !== index + 1) {
            item.displayOrder = index + 1;
            item.updatedAt = at;
        }
    });
}

interface BannerWriteBody {
    eventId?: unknown;
    imageKey?: unknown;
    displayOrder?: unknown;
}

// BannerWrite 검증 — 형식 오류와 존재하지 않는 이벤트를 구분해 상태 코드를 돌려준다
function validateWriteBody(
    body: BannerWriteBody,
    maxOrder: number,
): { status: number; code: string; message: string } | null {
    if (typeof body.eventId !== 'string' || !body.eventId) {
        return { status: 400, code: 'COMMON-002', message: '연결할 이벤트를 선택하세요' };
    }
    if (
        typeof body.imageKey !== 'string' ||
        body.imageKey.trim().length < 1 ||
        body.imageKey.length > 500
    ) {
        return { status: 400, code: 'COMMON-002', message: '이미지 키는 1~500자로 입력하세요' };
    }
    if (
        typeof body.displayOrder !== 'number' ||
        !Number.isInteger(body.displayOrder) ||
        body.displayOrder < 1 ||
        body.displayOrder > maxOrder
    ) {
        return {
            status: 400,
            code: 'BANNER-001',
            message: `노출 순서는 1~${maxOrder} 정수여야 합니다`,
        };
    }
    if (mockAdminEventIsCanceled(body.eventId)) {
        return {
            status: 409,
            code: 'BANNER-007',
            message: '취소된 이벤트에는 배너를 연결할 수 없습니다.',
        };
    }
    if (!findMockEvent(body.eventId)) {
        return { status: 404, code: 'BANNER-006', message: '연결할 이벤트를 찾을 수 없습니다' };
    }
    return null;
}

const readBody = async (request: Request) =>
    (await request.json().catch(() => null)) as BannerWriteBody | null;

export const bannerHandlers = [
    // B01 — 공개 배너 목록: Banner = id/eventId/imageUrl/displayOrder (spec 채택, 배열을 data에 싣는다)
    http.get(api('/v1/banners'), () =>
        ok(
            sorted()
                .filter(
                    (item) =>
                        item.eventId !== null &&
                        findMockEvent(item.eventId) !== null &&
                        !mockAdminEventIsCanceled(item.eventId),
                )
                .map(({ id, eventId, imageKey, displayOrder }) => ({
                    id,
                    eventId,
                    imageUrl: imageUrlOf(imageKey),
                    displayOrder,
                })),
        ),
    ),

    // AB01 — 관리자 목록
    http.get(api('/v1/admin/banners'), () => ok(sorted().map(toAdminResponse))),

    // AB02 — 등록: 최대 5개를 넘으면 409
    http.post(api('/v1/admin/banners'), async ({ request }) => {
        const body = await readBody(request);
        if (!body) return fail(400, 'COMMON-002', '요청 본문이 올바르지 않습니다');
        const error = validateWriteBody(body, mockBanners.length + 1);
        if (error) return fail(error.status, error.code, error.message);
        if (mockBanners.length >= BANNER_MAX_COUNT) {
            return fail(
                409,
                'BANNER-004',
                `배너는 최대 ${BANNER_MAX_COUNT}개까지 등록할 수 있습니다`,
            );
        }

        const at = mockNow().toISOString();
        const item: MockBanner = {
            id: crypto.randomUUID(),
            eventId: body.eventId as string,
            imageKey: (body.imageKey as string).trim(),
            displayOrder: body.displayOrder as number,
            createdAt: at,
            updatedAt: at,
        };
        const ordered = sorted();
        ordered.splice(item.displayOrder - 1, 0, item);
        mockBanners.push(item);
        applyOrder(ordered, at);
        return ok(toAdminResponse(item), 201);
    }),

    // AB05 — 순서 변경: 현재 배너 전체 ID를 중복 없이 노출 순서대로 받아 원자적으로 반영한다.
    // 정적 경로라 :bannerId 경로보다 먼저 등록한다
    http.put(api('/v1/admin/banners/order'), async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { bannerIds?: unknown } | null;
        const ids = body?.bannerIds;
        if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
            return fail(400, 'COMMON-002', 'bannerIds는 ID 배열이어야 합니다');
        }
        const requested = ids as string[];
        const current = new Set(mockBanners.map((b) => b.id));
        if (
            requested.length !== current.size ||
            new Set(requested).size !== requested.length ||
            requested.some((id) => !current.has(id))
        ) {
            return fail(409, 'BANNER-005', '현재 배너 목록과 일치하지 않습니다');
        }

        const at = mockNow().toISOString();
        applyOrder(
            requested.map((id) => mockBanners.find((item) => item.id === id)!),
            at,
        );
        return ok(sorted().map(toAdminResponse));
    }),

    // AB03 — 수정
    http.put(api('/v1/admin/banners/:bannerId'), async ({ params, request }) => {
        const item = mockBanners.find((b) => b.id === params.bannerId);
        if (!item) return fail(404, 'BANNER-003', '배너를 찾을 수 없습니다');
        const body = await readBody(request);
        if (!body) return fail(400, 'COMMON-002', '요청 본문이 올바르지 않습니다');
        const error = validateWriteBody(body, mockBanners.length);
        if (error) return fail(error.status, error.code, error.message);

        const ordered = sorted().filter((banner) => banner !== item);
        ordered.splice((body.displayOrder as number) - 1, 0, item);
        item.eventId = body.eventId as string;
        item.imageKey = (body.imageKey as string).trim();
        item.updatedAt = mockNow().toISOString();
        applyOrder(ordered, item.updatedAt);
        return ok(toAdminResponse(item));
    }),

    // AB04 — 삭제
    http.delete(api('/v1/admin/banners/:bannerId'), ({ params }) => {
        const index = mockBanners.findIndex((b) => b.id === params.bannerId);
        if (index < 0) return fail(404, 'BANNER-003', '배너를 찾을 수 없습니다');
        mockBanners.splice(index, 1);
        applyOrder(sorted(), mockNow().toISOString());
        return ok(null);
    }),
];
