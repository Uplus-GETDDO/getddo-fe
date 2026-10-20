import { Input } from '@shared/ui/input';
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group';
import { Textarea } from '@shared/ui/textarea';
import { cn } from '@shared/utils/cn';

import type { MissionQuestion } from '../model/types';
import type { MissionAnswerDraft } from '../utils/missionAnswers';

/** 선택 칸 공통 — 테두리 대신 옅은 회색으로 채워 누를 수 있는 칸으로 보이게 한다. 고른 칸은 Radix 라디오의 data-state로 판단한다 */
const FILLED_CHOICE =
    'bg-surface-sunken hover:bg-surface-pressed border-transparent has-[:focus-visible]:ring-border-focus cursor-pointer border-2 transition-colors has-[:focus-visible]:ring-2';

/** 설문 선택지 — 고르면 흰 바탕에 검정 테두리 */
const CHOICE_ROW = `${FILLED_CHOICE} has-[[data-state=checked]]:border-fg-primary has-[[data-state=checked]]:bg-surface-page flex items-center gap-3 rounded-xl px-4 py-3`;

/** 퀴즈 선택지 — 고르면 연노랑 (정답을 고르는 순간이 응모권으로 이어지는 퀴즈만 노랑) */
const CHOICE_ROW_QUIZ = `${FILLED_CHOICE} has-[[data-state=checked]]:border-ticket-primary has-[[data-state=checked]]:bg-ticket-accent flex items-center gap-3 rounded-xl px-4 py-3 text-left`;

/** OX 칸 — 설문은 고르면 검정 테두리, 퀴즈는 노랑으로 채운다 */
const OX_TILE = `${FILLED_CHOICE} has-[[data-state=checked]]:border-fg-primary has-[[data-state=checked]]:bg-surface-page flex h-28 items-center justify-center rounded-2xl`;
const OX_TILE_QUIZ = `${FILLED_CHOICE} has-[[data-state=checked]]:border-ticket-primary has-[[data-state=checked]]:bg-ticket-primary flex h-28 items-center justify-center rounded-2xl`;

interface MissionQuestionFieldProps {
    question: MissionQuestion;
    value: MissionAnswerDraft | undefined;
    onChange: (draft: MissionAnswerDraft) => void;
    /** 제출 시도 후 필수 문항이 비어 있으면 true — 오류 표시용 */
    invalid?: boolean;
    /** 제출 처리 중이면 true — 전송 중 답변이 바뀌지 않게 입력을 잠근다 */
    disabled?: boolean;
    /** 문항 번호(1부터) — 있으면 문항 위에 Q1처럼 보여 준다 */
    number?: number;
    /** 퀴즈 — 번호·문항 가운데 정렬, 구분선 없이, 고른 칸은 노랑 */
    centered?: boolean;
}

/**
 * 미션 문항 하나의 입력 UI — OX는 큰 O·X 두 칸, 단일 선택은 선택지 카드, 서술형(단답·자유 서술)은 텍스트 입력.
 * 설문은 고른 칸을 진한 테두리로, 퀴즈는 노랑 채움으로 표시한다.
 * 문항끼리는 테두리 상자 대신 구분선으로 나눈다 — 모달 안에 상자가 겹겹이 보이지 않게.
 * 필수 문항은 문항 글 옆에 별표(*), 선택 문항은 번호 옆에 "· 선택"을 붙인다.
 * 제출 변환·검증은 utils/missionAnswers가 담당하고, 여기는 표시와 입력만 한다.
 */
export function MissionQuestionField({
    question,
    value,
    onChange,
    invalid = false,
    disabled = false,
    number,
    centered = false,
}: MissionQuestionFieldProps) {
    const options = [...question.options].sort((a, b) => a.displayOrder - b.displayOrder);

    return (
        <fieldset
            disabled={disabled}
            className={cn(
                centered
                    ? 'flex flex-col gap-5 text-center not-first:mt-8'
                    : 'border-border-default flex flex-col gap-3 border-b py-6 first:pt-1 last-of-type:border-b-0',
            )}
        >
            <legend className="sr-only">
                {question.questionText}
                {question.required && ' (필수)'}
            </legend>
            <div className="flex flex-col gap-1.5">
                {number !== undefined && (
                    <span
                        className={
                            centered
                                ? 'text-body-sm-bold text-fg-secondary'
                                : 'text-caption text-fg-tertiary font-semibold'
                        }
                    >
                        Q{number}
                        {centered && '.'}
                        {!question.required && ' · 선택'}
                    </span>
                )}
                <p className="text-title-3 text-fg-primary">
                    {question.questionText}
                    {question.required && (
                        <span aria-label="필수" className="text-destructive ml-1">
                            *
                        </span>
                    )}
                </p>
            </div>

            {question.questionType === 'OX' || question.questionType === 'SINGLE_CHOICE' ? (
                <RadioGroup
                    name={question.id}
                    // 미선택은 ''로 고정 — undefined로 두면 비제어→제어 전환 경고가 난다
                    value={value?.selectedOptionId ?? ''}
                    onValueChange={(selectedOptionId) => onChange({ selectedOptionId })}
                    // 별표는 눈으로만 보이는 표시 — 화면 읽기 프로그램에는 입력 컨트롤에 필수 여부를 알린다
                    aria-required={question.required}
                    className={question.questionType === 'OX' ? 'grid-cols-2 gap-3' : 'gap-2'}
                >
                    {options.map((option) =>
                        question.questionType === 'OX' ? (
                            // OX — 동그라미는 라디오를 숨기고 큰 글자 칸 전체를 누르게 한다
                            <label
                                key={option.id}
                                htmlFor={option.id}
                                className={centered ? OX_TILE_QUIZ : OX_TILE}
                            >
                                {/* 라디오는 감싼 span으로 숨긴다 — 라디오 자체에 sr-only를 주면 기본 size-4·relative가 이겨 16px 자리를 차지해 글자가 오른쪽으로 밀린다 */}
                                <span className="sr-only">
                                    <RadioGroupItem id={option.id} value={option.id} />
                                </span>
                                <span className="text-fg-primary text-[3rem] leading-none font-extrabold">
                                    {option.optionText}
                                </span>
                            </label>
                        ) : (
                            <label
                                key={option.id}
                                htmlFor={option.id}
                                className={centered ? CHOICE_ROW_QUIZ : CHOICE_ROW}
                            >
                                <RadioGroupItem id={option.id} value={option.id} />
                                <span className="text-body text-fg-primary">
                                    {option.optionText}
                                </span>
                            </label>
                        ),
                    )}
                </RadioGroup>
            ) : question.questionType === 'SHORT_ANSWER' ? (
                <Input
                    name={question.id}
                    value={value?.answerText ?? ''}
                    onChange={(event) => onChange({ answerText: event.target.value })}
                    placeholder="정답을 입력해 주세요"
                    aria-invalid={invalid || undefined}
                    aria-required={question.required}
                    // 아래 제출 버튼(Large 48px)과 같은 높이 — 기본 32px은 답 칸으로 너무 얇았다
                    className="bg-surface-page h-12 px-4"
                />
            ) : (
                <Textarea
                    name={question.id}
                    value={value?.answerText ?? ''}
                    onChange={(event) => onChange({ answerText: event.target.value })}
                    placeholder="답변을 입력해 주세요"
                    aria-invalid={invalid || undefined}
                    aria-required={question.required}
                    className="bg-surface-page"
                    rows={4}
                />
            )}

            {invalid && (
                <p className="text-body-sm text-destructive">필수 문항입니다. 답변해 주세요.</p>
            )}
        </fieldset>
    );
}
