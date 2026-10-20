import type { MissionSummary } from '@entities/mission';

import { useMissionDetail } from '@entities/mission';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { formatKst } from '@shared/utils/date';

import {
    getMissionPhase,
    MISSION_KIND_LABEL,
    missionQuestionSummary,
    missionUrgentDeadline,
} from '../utils/missionBoard';
import { MissionReward } from './MissionReward';

const MISSION_ACTION = { QUIZ: '퀴즈 풀기', SURVEY: '설문 참여' } as const;

const START_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };

/**
 * 설문·퀴즈 카드 — 위에 설문/퀴즈 칩과 급한 마감 칩(오늘 마감·D-7 이내만), 제목,
 * 보상과 문항 요약 한 줄("🎟 +1 · 2문항 · 필수 1개"), 오른쪽에 Medium(40) 버튼.
 * 완료·종료한 미션은 버튼을 흐리게 두고 요약 줄도 흐리게 한다 (상태는 버튼이 말해 준다). 종료된 미션은 보상만 남긴다.
 * 문항 수는 목록 계약(MissionSummary)에 없어 종료되지 않았거나 참여 완료한 미션만 상세를 미리 불러와 센다 —
 * 모달과 같은 쿼리라 모달이 바로 열린다. 목록에 questionCount가 생기면 그걸로 바꾼다
 * onOpen: 풀이 모달을 연다 (목록 페이지가 모달을 들고 있다)
 */
export function MissionCard({
    mission,
    now,
    onOpen,
}: {
    mission: MissionSummary;
    now: Date;
    onOpen: (missionId: string) => void;
}) {
    const phase = getMissionPhase(mission, now);
    const deadline = missionUrgentDeadline(mission.endsAt, now);
    const muted = mission.completed || phase === 'ended';
    // 문항 요약은 참여 완료한 미션에도 둔다 — 기간이 끝나 참여하지 못한 미션만 상세를 부르지 않는다
    const showSummary = mission.completed || phase !== 'ended';
    const { data: detail } = useMissionDetail(mission.id, { enabled: showSummary });
    const summary = detail && showSummary ? missionQuestionSummary(detail.questions) : null;

    return (
        <article
            // 위쪽 출석·내역·게임 카드와 같이 테두리를 둔다. 완료·종료 카드는 회색 바탕에 그림자 없이
            className={`border-border-default flex items-center justify-between gap-4 rounded-2xl border p-5 ${muted ? 'bg-surface-sunken' : 'bg-surface-page shadow-md'}`}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                    {/* 완료·종료 카드는 회색 바탕이라 칩을 흰 바탕+테두리로 바꿔 묻히지 않게 한다 */}
                    <Badge variant={muted ? 'outline' : 'neutral'}>
                        {MISSION_KIND_LABEL[mission.missionType]}
                    </Badge>
                    {/* 참여 완료한 미션에는 마감 정보가 필요 없다. 마감은 7일 이내만 칩으로 — 멀리 남은 D-day는 급한 정보가 아니다 */}
                    {!mission.completed &&
                        (phase === 'upcoming' ? (
                            <Badge variant="outline">
                                {formatKst(mission.startsAt, START_FORMAT)} 시작
                            </Badge>
                        ) : (
                            deadline && (
                                // 오늘 마감은 겟또타임·이벤트 카드의 D-day처럼 검정 알약, 그 밖에는 종류 칩(회색)과
                                // 겹치지 않게 흰 바탕+테두리
                                <Badge variant={deadline === '오늘 마감' ? 'inverse' : 'outline'}>
                                    {deadline}
                                </Badge>
                            )
                        ))}
                </div>
                <h3 className={`text-body-bold ${muted ? 'text-fg-secondary' : 'text-fg-primary'}`}>
                    {mission.title}
                </h3>
                <p className="text-body-sm text-fg-tertiary flex flex-wrap items-center gap-x-1.5">
                    <MissionReward count={mission.rewardTicketCount} muted={muted} />
                    {summary && <span>· {summary}</span>}
                </p>
            </div>
            {mission.completed ? (
                <Button disabled className="px-7">
                    참여 완료
                </Button>
            ) : phase === 'open' ? (
                <Button
                    // 공용 secondary Medium(40) — 카드마다 반복되는 행동이라 한 단계 낮춘다 (화면의 주 행동은 출석하기). 참여를 마치면 흐린 '참여 완료'로 바뀐다
                    variant="secondary"
                    className="px-7"
                    onClick={() => onOpen(mission.id)}
                >
                    {MISSION_ACTION[mission.missionType]}
                </Button>
            ) : (
                <Button disabled className="px-7">
                    {phase === 'upcoming' ? '곧 시작' : '기간 종료'}
                </Button>
            )}
        </article>
    );
}
