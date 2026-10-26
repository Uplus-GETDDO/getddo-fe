import { useState } from 'react';

import type { DrawResult } from '@entities/drawResult';

import { useDrawCandidates } from '@entities/drawResult';
import { MEMBERSHIP_LABEL, membershipRuleSchema } from '@entities/event';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { LoadingBlock, SkeletonRows } from '@shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';
import { cn } from '@shared/utils/cn';

import { PagedCount, PagedFooter } from './PagedFooter';

/** 자격 스냅샷의 멤버십(excellent·vip·vvip)을 화면 라벨(우수·VIP·VVIP)로 — 모르는 값은 원문, 없으면 — */
function membershipLabel(value: unknown) {
    const parsed = membershipRuleSchema.safeParse(value);
    if (parsed.success) return MEMBERSHIP_LABEL[parsed.data];
    return typeof value === 'string' ? value : '—';
}

const PAGE_SIZE = 10;
// 상태·분류 칩 — 사용자 화면과 같은 공용 배지 모양(둥근 알약, 높이 26·글자 12)에 색만 칩마다 입힌다
const CHIP = badgeVariants({ variant: null });

const GRADES = [
    ['bronze', '브론즈'],
    ['silver', '실버'],
    ['gold', '골드'],
] as const;

// 등급별 실제 차감 장수 — entrySnapshot은 계약상 자유 객체라 알려진 키만 읽는다
const gradeSummary = (snapshot: Record<string, unknown>) =>
    GRADES.filter(([key]) => typeof snapshot[key] === 'number' && snapshot[key] > 0)
        .map(([key, label]) => `${label} ${snapshot[key] as number}`)
        .join(' · ') || '—';

// AD03 — 이 실행이 실제 사용한 후보 명단 (실행 시점에 고정된 스냅샷).
// 선정 표시는 이 실행의 결과와 후보를 ID로 연결한 것이다 — 이후 취소로 바뀐 현재 상태와
// 과거 선정 사실을 구분해 보여 준다
export function DrawCandidatesSection({
    drawId,
    results,
}: {
    drawId: string;
    results: DrawResult[];
}) {
    const [page, setPage] = useState(1);
    const { data, isPending, isError, refetch } = useDrawCandidates(drawId, {
        page,
        size: PAGE_SIZE,
    });
    const resultByCandidate = new Map(
        results.filter((r) => r.candidateId).map((r) => [r.candidateId, r] as const),
    );

    return (
        <section
            aria-labelledby="draw-candidates-title"
            className="bg-surface-page border-border-default flex flex-col gap-4 rounded-2xl border p-6"
        >
            <div className="flex flex-col gap-1">
                <h3 id="draw-candidates-title" className="text-body-bold text-fg-primary">
                    후보 명단
                </h3>
                <p className="text-caption text-fg-tertiary">
                    응모권 수는 실제 차감 장수, 가중치는 등급별 값(브론즈 1·실버 3·골드 5)을 곱해
                    합산한 값입니다. 재추첨 후보는 기존 당첨자·취소자를 제외하며 최초 후보의
                    스냅샷을 재사용합니다.
                </p>
            </div>

            {isPending && (
                <LoadingBlock>
                    <SkeletonRows rows={4} />
                </LoadingBlock>
            )}
            {isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-semantic-error-strong text-body-sm">
                        후보 명단을 불러오지 못했습니다.
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                        다시 시도
                    </Button>
                </div>
            )}
            {data && data.items.length === 0 && (
                <p className="text-body-sm text-fg-tertiary">후보가 없습니다.</p>
            )}
            {data && data.items.length > 0 && (
                <>
                    <PagedCount total={data.totalElements} />
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>사용자</TableHead>
                                <TableHead>응모권 수</TableHead>
                                <TableHead>가중치</TableHead>
                                <TableHead>등급별 차감</TableHead>
                                <TableHead>멤버십</TableHead>
                                <TableHead>이 실행에서 선정</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.items.map((candidate) => {
                                const selected = resultByCandidate.get(candidate.id);
                                return (
                                    <TableRow key={candidate.id} className="hover:bg-transparent">
                                        <TableCell className="font-medium">
                                            {candidate.userName ?? candidate.userId}
                                            {candidate.userName && (
                                                <span className="text-caption text-fg-secondary block font-normal">
                                                    {candidate.userId}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>{candidate.ticketCount}장</TableCell>
                                        <TableCell>{candidate.weight}</TableCell>
                                        <TableCell className="text-fg-secondary">
                                            {gradeSummary(candidate.entrySnapshot)}
                                        </TableCell>
                                        <TableCell className="text-fg-secondary">
                                            {membershipLabel(
                                                candidate.eligibilitySnapshot.membership,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {selected ? (
                                                selected.isCanceled ? (
                                                    <span
                                                        className={cn(
                                                            CHIP,
                                                            'bg-status-rejected text-status-rejected-text',
                                                        )}
                                                    >
                                                        선정 후 취소
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={cn(
                                                            CHIP,
                                                            'bg-status-approved text-status-approved-text',
                                                        )}
                                                    >
                                                        선정됨
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-fg-tertiary">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <PagedFooter
                        page={page}
                        size={PAGE_SIZE}
                        totalElements={data.totalElements}
                        onPageChange={setPage}
                    />
                </>
            )}
        </section>
    );
}
