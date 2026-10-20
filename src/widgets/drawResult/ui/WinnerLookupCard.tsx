import { useId, useState } from 'react';

import type { PublishedPrize } from '@entities/drawResult';

import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

const SUFFIX_LENGTH = 4;

interface WinnerLookupCardProps {
    prizes: PublishedPrize[];
    /** 찾은 뒷자리를 올려 보낸다 — 명단에서 같은 줄을 강조하는 데만 쓴다 */
    onLookup: (suffix: string | null) => void;
}

/**
 * 휴대폰 뒷자리로 공개 명단을 찾아보는 카드.
 *
 * 이미 공개된 명단 안에서 찾는 것이라 서버에 따로 묻지 않는다 — 명단에 없는 정보를
 * 꺼내 오는 조회가 아니므로 공개 범위가 넓어지지 않는다.
 *
 * 뒷자리는 여러 사람이 같을 수 있어 '당신이 당첨됐다'고 말하지 않는다. 본인 당첨 여부는
 * 로그인한 사용자의 결과 조회(E09)가 판정하고, 여기서는 명단에 그 번호가 있는지만 알려 준다.
 */
export function WinnerLookupCard({ prizes, onLookup }: WinnerLookupCardProps) {
    const inputId = useId();
    const [suffix, setSuffix] = useState('');
    const [result, setResult] = useState<{ suffix: string; matchCount: number } | null>(null);

    const isComplete = suffix.length === SUFFIX_LENGTH;

    const lookup = () => {
        if (!isComplete) return;
        const matchCount = prizes.reduce(
            (count, prize) =>
                count + prize.winners.filter((winner) => winner.maskedPhoneNum === suffix).length,
            0,
        );
        setResult({ suffix, matchCount });
        onLookup(matchCount > 0 ? suffix : null);
    };

    return (
        <section className="bg-surface-page border-border-default flex flex-col items-center gap-6 rounded-2xl border p-8">
            {result == null ? (
                <h3 className="text-title-3 text-fg-primary">당첨자 조회</h3>
            ) : result.matchCount > 0 ? (
                <>
                    <h3 className="text-title-3 text-fg-primary">명단에 이 번호가 있어요</h3>
                    <p className="text-body text-fg-secondary text-center">
                        아래 명단에서 {result.suffix}로 끝나는 당첨자
                        {result.matchCount > 1 ? ` ${result.matchCount}명을 ` : '를 '}
                        표시했어요.
                        {/* 뒷자리만으로는 본인인지 알 수 없다 — 당첨을 확정해 말하지 않는다 */}
                        {result.matchCount > 1 && ' 뒷자리가 같은 분이 여럿이에요.'}
                    </p>
                </>
            ) : (
                <>
                    <h3 className="text-title-3 text-fg-primary">명단에 없는 번호예요</h3>
                    {/* 조회 결과가 없다고 '낙첨'으로 단정하지 않는다 — 입력을 잘못했을 수도 있다 */}
                    <p className="text-body text-fg-secondary text-center">
                        입력한 뒷자리와 일치하는 당첨자가 없어요. 번호를 다시 확인해 주세요.
                    </p>
                </>
            )}

            <div className="flex w-full max-w-80 flex-col items-center gap-2">
                <label htmlFor={inputId} className="sr-only">
                    휴대폰 뒷자리 4자리
                </label>
                <Input
                    id={inputId}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={SUFFIX_LENGTH}
                    placeholder="0000"
                    value={suffix}
                    onChange={(e) => {
                        // 숫자만 받는다 — 서버가 내려준 뒷자리와 그대로 맞춰 보는 값이다
                        setSuffix(e.target.value.replace(/\D/g, '').slice(0, SUFFIX_LENGTH));
                        setResult(null);
                        onLookup(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && lookup()}
                    className="text-center tabular-nums"
                />
                <Button onClick={lookup} disabled={!isComplete} className="w-full">
                    {result == null ? '조회하기' : '다시 조회하기'}
                </Button>
                <p className="text-body-sm text-fg-tertiary text-center">
                    당첨자 조회는 휴대폰 뒷자리 번호(4자리)를 입력하여 확인 가능합니다.
                </p>
            </div>
        </section>
    );
}
