import { Clock, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useVirtualClock } from '@shared/model/virtualClock';
import { badgeVariants } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { cn } from '@shared/utils/cn';
import { formatKst, formatYmd, kstNextDateStartUtcIso } from '@shared/utils/date';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const SECOND_FORMAT: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
};

/** "YYYY-MM-DDTHH:mm" 입력값을 KST 시각으로 해석해 Date로 변환한다 (브라우저 TZ와 무관하게 동작) */
function parseKstLocal(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!m) return null;
    const [ys, mos, ds, hs, mis] = m.slice(1);
    if (!ys || !mos || !ds || !hs || !mis) return null;
    // Date.UTC는 연도 0–99를 1900+n으로 해석하므로 setUTCFullYear로 입력 연도를 그대로 둔다
    const d = new Date(0);
    d.setUTCFullYear(+ys, +mos - 1, +ds);
    d.setUTCHours(+hs, +mis, 0, 0);
    const at = new Date(d.getTime() - KST_OFFSET_MS);
    return Number.isNaN(at.getTime()) ? null : at;
}

const MINUTE = 60_000;
/** 시연에서 자주 쓰는 이동 — 지금 표시 시각에서 앞으로 */
const QUICK_JUMPS = [
    { label: '+10분', ms: 10 * MINUTE },
    { label: '+1시간', ms: 60 * MINUTE },
    { label: '+6시간', ms: 6 * 60 * MINUTE },
    { label: '+1일', ms: 24 * 60 * MINUTE },
] as const;

// 관리자 화면의 다른 칸과 같이 그림자 없이 테두리만 둔다
const PANEL = 'shadow-none';

function formatOffset(diffMs: number): string {
    const minutes = Math.round(Math.abs(diffMs) / 60_000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts = [
        days > 0 ? `${days}일` : '',
        hours > 0 ? `${hours}시간` : '',
        mins > 0 ? `${mins}분` : '',
    ].filter(Boolean);
    return `${diffMs >= 0 ? '+' : '-'}${parts.join(' ') || '0분'}`;
}

export function VirtualClockControl() {
    const { now, setOverride, override, isOverridden } = useVirtualClock();
    // 1초마다 갱신되는 실제 시각 — 오버라이드 차이와 비교 표시에 사용한다
    const [realNow, setRealNow] = useState<Date | null>(null);
    const [absolute, setAbsolute] = useState('');

    useEffect(() => {
        const id = setInterval(() => setRealNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const applyAbsolute = () => {
        const at = parseKstLocal(absolute);
        if (at) setOverride(at);
    };

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card size="lg" className={PANEL}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="size-4" />
                        현재 표시 시각
                        {isOverridden && (
                            <span
                                className={cn(
                                    badgeVariants({ variant: null }),
                                    'bg-brand-soft text-fg-brand',
                                )}
                            >
                                시간 여행 중
                            </span>
                        )}
                    </CardTitle>
                    <CardDescription>
                        화면 표시와 로컬 목업에만 적용되는 로컬 개발 도구입니다. 서버의
                        마감·추첨·발표 일정과 응답은 실제 시각으로 동작하며 바뀌지 않습니다.
                        오버라이드 중에는 표시 시각이 이 값으로 고정됩니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="text-title-2 tabular-nums">
                            {formatKst(now(), SECOND_FORMAT)}
                        </span>
                        {isOverridden && override && realNow && (
                            <span className="text-body-sm text-fg-tertiary">
                                실제 시각 {formatKst(realNow, SECOND_FORMAT)} (
                                {formatOffset(override.getTime() - realNow.getTime())})
                            </span>
                        )}
                    </div>
                    {isOverridden && (
                        <div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setOverride(null)}
                            >
                                <RotateCcw className="size-4" />
                                실제 시각으로 복귀
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card size="lg" className={PANEL}>
                <CardHeader>
                    <CardTitle>특정 시각 지정</CardTitle>
                    <CardDescription>KST 기준으로 입력한 날짜·시각으로 이동합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="virtual-clock-at" className="text-body-sm font-medium">
                                이동할 시각
                            </label>
                            <Input
                                id="virtual-clock-at"
                                type="datetime-local"
                                step={600}
                                value={absolute}
                                onChange={(e) => setAbsolute(e.target.value)}
                                className="w-56"
                            />
                        </div>
                        <Button type="button" onClick={applyAbsolute} disabled={!absolute}>
                            지정
                        </Button>
                    </div>
                    {/* 빠른 이동 — 마감·추첨·발표 흐름을 시연할 때 지금 표시 시각에서 바로 앞으로 간다 */}
                    <div className="mt-5 flex flex-col gap-1.5">
                        <span className="text-body-sm font-medium">빠른 이동</span>
                        <div className="flex flex-wrap gap-2">
                            {QUICK_JUMPS.map(({ label, ms }) => (
                                <Button
                                    key={label}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setOverride(new Date(now().getTime() + ms))}
                                >
                                    {label}
                                </Button>
                            ))}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                    setOverride(
                                        new Date(
                                            kstNextDateStartUtcIso(formatYmd(now().toISOString())),
                                        ),
                                    )
                                }
                            >
                                다음 날 0시
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
