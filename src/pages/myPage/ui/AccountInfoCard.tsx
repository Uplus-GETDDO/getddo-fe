import { useState } from 'react';

import type { MembershipRule } from '@entities/event';
import type { VirtualUser } from '@entities/user';

import { MEMBERSHIP_LABEL } from '@entities/event';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/utils/cn';

import { SectionCard } from './SectionCard';

/** 멤버십 등급 순서 — 우수 < VIP < VVIP (getddo-spec 02-domain/entry.md) */
const MEMBERSHIP_ORDER: MembershipRule[] = ['excellent', 'vip', 'vvip'];

/** 사용자 ID는 앞뒤 4자만 보이고 가운데를 가린다 — 화면 공유·어깨너머로 그대로 드러나지 않게 */
function maskId(id: string) {
    return id.length <= 8 ? '••••' : `${id.slice(0, 4)}••••${id.slice(-4)}`;
}

/**
 * 계정 정보 — 바꿀 수 없는 값(ID·유형·멤버십)만 보여 준다. 이메일·휴대폰은 계정에 없어 지어내지 않는다.
 * 사용자 ID는 처음엔 가려 두고 '보기'를 눌러야 전체가 보인다 (멘토링: 바로 노출하지 않기).
 * 아래에 멤버십별 차이를 안내한다 — 멤버십은 유플러스 계정 등급에서 정해지고(이 서비스에서 바꾸지 않는다), 등급은 이벤트마다 정해진 최소 등급으로 응모·시작 알림 대상을 가를 뿐,
 * 추첨 가중치 같은 다른 혜택은 없다 (ADR-013 범위 밖). 그래서 '응모할 수 있는 이벤트'로만 설명한다
 */
export function AccountInfoCard({ user }: { user: VirtualUser }) {
    const [idShown, setIdShown] = useState(false);
    const current = MEMBERSHIP_ORDER.indexOf(user.membership);

    return (
        <SectionCard title="계정 정보" description="계정 정보는 바꿀 수 없어요.">
            <dl className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-body-sm text-fg-tertiary shrink-0">사용자 ID</dt>
                    <dd className="flex min-w-0 items-center gap-2">
                        {/* 펼친 ID는 좁은 화면에서도 끝까지 보이게 줄을 바꾼다 */}
                        <span
                            className={cn(
                                'text-body-sm-bold text-fg-primary tabular-nums',
                                idShown ? 'break-all' : 'truncate',
                            )}
                        >
                            {idShown ? user.id : maskId(user.id)}
                        </span>
                        <Button
                            variant="link"
                            size="text"
                            // 글자가 보기·숨기기로 바뀌므로 aria-pressed 대신 무엇을 하는지 이름에 담는다
                            aria-label={idShown ? '사용자 ID 숨기기' : '사용자 ID 보기'}
                            onClick={() => setIdShown((shown) => !shown)}
                        >
                            {idShown ? '숨기기' : '보기'}
                        </Button>
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-body-sm text-fg-tertiary">유형</dt>
                    <dd className="text-body-sm-bold text-fg-primary truncate">
                        {user.personaLabel ?? '시스템 관리 계정'}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-body-sm text-fg-tertiary">멤버십</dt>
                    <dd className="text-body-sm-bold text-fg-primary truncate">
                        {MEMBERSHIP_LABEL[user.membership]}
                    </dd>
                </div>
            </dl>

            <div className="bg-surface-sunken flex flex-col gap-3 rounded-xl p-4">
                <p className="text-body-sm-bold text-fg-primary">멤버십별 차이</p>
                {/* 낮은 등급부터 — 내 등급과 그 아래는 응모할 수 있는 등급이라 진하게, 위 등급은 옅게 */}
                <ol aria-label="멤버십 등급 순서" className="flex items-center gap-2">
                    {MEMBERSHIP_ORDER.map((rule, index) => (
                        <li key={rule} className="flex items-center gap-2">
                            {index > 0 && (
                                <span aria-hidden className="text-fg-tertiary text-caption">
                                    ›
                                </span>
                            )}
                            <Badge
                                variant={index === current ? 'inverse' : 'outline'}
                                size="sm"
                                className={cn(
                                    index === current && 'font-semibold',
                                    index > current && 'text-fg-tertiary',
                                )}
                            >
                                {MEMBERSHIP_LABEL[rule]}
                                {index === current && <span className="sr-only"> (내 등급)</span>}
                            </Badge>
                        </li>
                    ))}
                </ol>
                <ul className="text-body-sm text-fg-secondary flex list-disc flex-col gap-1 pl-4">
                    <li>
                        멤버십은 유플러스 계정의 등급을 따라요. 이 서비스에서 따로 올리거나 바꿀 수
                        없어요.
                    </li>
                    <li>
                        이벤트마다 응모할 수 있는 최소 등급이 있어요. 그 등급 이상이면 응모할 수
                        있어요.
                    </li>
                    <li>등급이 높을수록 응모할 수 있는 이벤트가 많아요.</li>
                    <li>이벤트 시작 알림도 응모할 수 있는 이벤트만 받아요.</li>
                </ul>
            </div>
        </SectionCard>
    );
}
