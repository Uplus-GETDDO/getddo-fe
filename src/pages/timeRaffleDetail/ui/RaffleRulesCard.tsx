import type { Event } from '@entities/event';

import {
    TICKET_GRADE_DOT,
    TICKET_GRADE_LABEL,
    TICKET_GRADE_WEIGHT,
    TICKET_GRADES,
} from '@entities/ticket';
import { BulletList } from '@shared/ui/bullet-list';
import { KST_HOUR_MINUTE, formatKst } from '@shared/utils/date';

// 운영 정책 고지 — 모든 래플에 공통이라 이벤트 안내 아래에 작게 둔다
const POLICY_RULES = [
    '비정상적이거나 대리 응모 등 불공정한 방법으로 참여가 적발될 시, 당첨이 자동 취소되며 향후 서비스 이용이 제한될 수 있습니다.',
    '추첨 후보·조건 스냅샷과 결과 정합성이 보존되며, 관리자 승인 후 결과가 공개됩니다.',
    '상태는 모집 중·마감·발표 대기·취소 등으로 구분되며, 운영 정책에 따라 상태가 변경될 수 있습니다.',
    '취소 시에는 연결된 반환 이력이 별도로 보존되며, 제외·응모자 없음·추첨 대상자 없음 등 예외 상황 발생 시 운영 정책에 따라 처리됩니다.',
];

/** 이 래플에 응모권을 몇 번·몇 장 낼 수 있는지 — 누적 상한(ADR-010)에 따라 문장이 갈린다 */
function entryLimitRule(event: Event): string {
    if (event.eventType === 'NO_TICKET') return '응모권 없이 한 번 참여할 수 있어요.';
    // 상한 실값은 상세(E02)에만 있다 — 목록만으로 만든 이벤트는 상한 문구를 적지 않는다
    if (event.maxTicketsPerUser === undefined) return '응모권으로 이 래플에 응모할 수 있어요.';
    if (event.maxTicketsPerUser === null)
        return '마감 전까지 장수 제한 없이 나눠서 응모할 수 있어요.';
    if (event.maxTicketsPerUser <= event.requiredTickets)
        return `응모권 ${event.requiredTickets}장으로 한 번 응모할 수 있어요.`;
    return `응모권은 이 래플에 최대 ${event.maxTicketsPerUser}장까지 쓸 수 있고, 마감 전까지 나눠서 더 응모할 수 있어요.`;
}

/**
 * 응모 및 추첨 안내.
 *
 * 응모권을 쓰는 래플은 등급이 추첨에 얼마나 들어가는지 표로 먼저 보인다. 소비자 화면이라 '가중치' 대신
 * '추첨 반영'이라 적는다. 당첨 확률은 응모자 수에 따라 달라져 보여 주지 않는다 (getddo-spec 요구사항 §7)
 */
export function RaffleRulesCard({ event }: { event: Event }) {
    const usesTickets = event.eventType === 'TICKET';
    const gradeReflected = usesTickets && event.weightingEnabled;

    const rules = [
        `${formatKst(event.startsAt, KST_HOUR_MINUTE)}에 시작해 ${formatKst(event.endsAt, KST_HOUR_MINUTE)}에 마감해요. 마감 뒤에는 응모할 수 없어요.`,
        entryLimitRule(event),
        // 사용자의 응모 취소는 제공하지 않는다 (getddo-spec 02-domain/entry.md)
        usesTickets ? '쓴 응모권은 되돌릴 수 없어요.' : '응모한 뒤에는 취소할 수 없어요.',
        // 발표 시각은 계약에 없다 — 자동 추첨 뒤 관리자 확인을 거쳐 공개한다 (ADR-022)
        '마감 뒤 자동으로 추첨하고, 결과는 관리자 확인을 거쳐 발표해요.',
        '당첨 확률은 응모자 수에 따라 달라져 따로 알려 드리지 않아요.',
    ];

    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-5 rounded-2xl border p-5">
            <h2 className="text-subhead text-fg-primary">응모 및 추첨 안내</h2>

            {usesTickets && (
                <table className="border-border-default w-full border-separate border-spacing-0 overflow-hidden rounded-xl border text-left">
                    <thead className="bg-surface-sunken">
                        <tr className="text-caption text-fg-tertiary">
                            <th scope="col" className="px-4 py-2.5 font-medium">
                                등급
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-medium">
                                추첨 반영
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-medium">
                                이 래플
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-body-sm text-fg-primary">
                        {TICKET_GRADES.map((grade) => {
                            // 등급 미반영 래플은 브론즈 1장으로만 받는다
                            const usable = gradeReflected || grade === 'BRONZE';
                            return (
                                <tr key={grade}>
                                    <th
                                        scope="row"
                                        className="border-border-default border-t px-4 py-3 font-normal"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                aria-hidden
                                                className={`${TICKET_GRADE_DOT[grade]} size-2 rounded-full`}
                                            />
                                            {TICKET_GRADE_LABEL[grade]}
                                        </span>
                                    </th>
                                    <td className="border-border-default border-t px-4 py-3 tabular-nums">
                                        브론즈 {TICKET_GRADE_WEIGHT[grade]}장만큼
                                    </td>
                                    <td
                                        className={`border-border-default border-t px-4 py-3 ${
                                            usable ? 'text-fg-primary' : 'text-fg-tertiary'
                                        }`}
                                    >
                                        {usable ? '사용 가능' : '사용 불가'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {/* 겟또타임 목록의 '추첨 결과 안내'와 같은 불릿 목록 — 안내 성격이 같아 모양을 맞춘다 */}
            <BulletList items={rules} />

            <div className="border-border-default flex flex-col gap-2 border-t pt-4">
                <p className="text-caption text-fg-tertiary font-semibold">운영 정책</p>
                <BulletList items={POLICY_RULES} size="sm" />
            </div>
        </section>
    );
}
