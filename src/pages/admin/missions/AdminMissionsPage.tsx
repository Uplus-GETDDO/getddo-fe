import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { AdminMissionsParams } from '@entities/mission';

import { MISSION_STATUS_LABEL, useAdminMissions } from '@entities/mission';
import { MissionFormDialog } from '@features/manageMission';
import { getErrorMessage } from '@shared/api/errorMessage';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { PagedResult } from '@shared/ui/paged-result';
import { formatKst, kstInputToUtcIso } from '@shared/utils/date';

import { MissionDetailDialog } from './ui/MissionDetailDialog';

interface Filters {
    keyword: string;
    missionType: '' | 'SURVEY' | 'QUIZ';
    status: '' | 'ACTIVE' | 'ENDED';
    from: string;
    to: string;
}
export function AdminMissionsPage() {
    const [params, setParams] = useState<AdminMissionsParams>({ page: 1 });
    const [selected, setSelected] = useState<string | null>(null);
    // DialogTrigger 없이 열어 Radix가 복귀 대상을 모른다 — 닫힘 후 이 버튼으로 포커스를 돌려준다
    const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const { register, handleSubmit } = useForm<Filters>({
        defaultValues: { keyword: '', missionType: '', status: '', from: '', to: '' },
    });
    const query = useAdminMissions(params);
    return (
        <>
            {/*
             * 화면 이름은 관리자 레이아웃 위쪽 바가 이미 띄운다 — 본문에서 또 적지 않는다.
             * 설명은 가운데 칸 밖에 둬서 다른 관리자 화면과 같은 자리에서 시작하게 하고,
             * 제목이 이고 있던 등록 버튼만 칸 안에 남긴다.
             */}
            <p className="text-body-sm text-fg-secondary">
                등록된 미션을 검색하고 상세와 설문 응답을 확인합니다.
            </p>
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
                <div className="flex justify-end">
                    <Button className="min-h-11" onClick={() => setOpen(true)}>
                        미션 등록
                    </Button>
                </div>
                <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(event) =>
                        void handleSubmit((values) => {
                            if (values.from && values.to && values.from >= values.to) {
                                setError('검색 종료는 시작보다 늦어야 합니다.');
                                return;
                            }
                            setError('');
                            setSelected(null);
                            setParams({
                                page: 1,
                                keyword: values.keyword || undefined,
                                missionType: values.missionType || undefined,
                                status: values.status || undefined,
                                from: values.from ? kstInputToUtcIso(values.from) : undefined,
                                to: values.to ? kstInputToUtcIso(values.to) : undefined,
                            });
                        })(event)
                    }
                >
                    <label className="flex min-w-0 flex-1 flex-col gap-2">
                        검색어
                        <Input className="min-h-11" {...register('keyword')} />
                    </label>
                    <label className="flex flex-col gap-2">
                        유형
                        <select
                            className="border-border-default bg-surface-elevated min-h-11 rounded-md border p-2"
                            {...register('missionType')}
                        >
                            <option value="">전체</option>
                            <option value="SURVEY">설문</option>
                            <option value="QUIZ">퀴즈</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-2">
                        상태
                        <select
                            className="border-border-default bg-surface-elevated min-h-11 rounded-md border p-2"
                            {...register('status')}
                        >
                            <option value="">전체</option>
                            {Object.entries(MISSION_STATUS_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-2">
                        시작 시각 하한 (KST)
                        <Input className="min-h-11" type="datetime-local" {...register('from')} />
                    </label>
                    <label className="flex min-w-0 flex-col gap-2">
                        시작 시각 상한 미포함 (KST)
                        <Input className="min-h-11" type="datetime-local" {...register('to')} />
                    </label>
                    <Button className="min-h-11" type="submit">
                        검색
                    </Button>
                </form>
                {error && <p role="alert">{error}</p>}
                <p className="text-caption text-fg-tertiary">
                    종료 시각이 지난 미션은 서버 주기 처리로 최대 약 1분 뒤 '종료'로 표시됩니다.
                </p>
                <PagedResult
                    {...query}
                    page={params.page}
                    onPageChange={(page) => {
                        setSelected(null);
                        setParams({ ...params, page });
                    }}
                    emptyText="등록된 미션이 없습니다."
                    errorText={getErrorMessage(
                        query.error,
                        '미션을 조회하지 못했습니다. 이전 성공값이 있으면 유지합니다.',
                    )}
                    onRetry={() => void query.refetch()}
                >
                    {(items) => (
                        <ul className="flex flex-col gap-3">
                            {items.map((m) => (
                                <li
                                    key={m.id}
                                    className="border-border-default flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                                >
                                    <div className="min-w-0 break-words">
                                        <p>{m.title}</p>
                                        <p>
                                            {m.missionType} · {MISSION_STATUS_LABEL[m.status]} ·
                                            보상 1장 · 작성 {m.createdByName ?? m.createdBy}
                                        </p>
                                        <p>
                                            {formatKst(m.startsAt)} ~ {formatKst(m.endsAt)} KST
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={(event) => {
                                            detailTriggerRef.current = event.currentTarget;
                                            setSelected(m.id);
                                        }}
                                        aria-label={`${m.title} 상세`}
                                    >
                                        상세
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </PagedResult>
                {selected && (
                    <MissionDetailDialog
                        key={selected}
                        id={selected}
                        onClose={() => {
                            setSelected(null);
                            const trigger = detailTriggerRef.current;
                            requestAnimationFrame(() => trigger?.focus());
                        }}
                    />
                )}
                {open && <MissionFormDialog open={open} onOpenChange={setOpen} />}
            </div>
        </>
    );
}
