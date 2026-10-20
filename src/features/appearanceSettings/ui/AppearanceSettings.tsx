import { Moon, Sun, SunMoon } from 'lucide-react';

import { useUiSettingsStore, type Theme } from '@shared/model/uiSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { cn } from '@shared/utils/cn';

const THEME_OPTIONS = [
    { value: 'system', label: '시스템 설정', icon: SunMoon },
    { value: 'light', label: '라이트', icon: Sun },
    { value: 'dark', label: '다크', icon: Moon },
] as const;

/**
 * 화면 설정 — 테마와 큰글씨 모드. 마이페이지 카드 틀(제목 title-3 + 한 줄 설명, 여백 24)과 맞춘다.
 * 큰글씨 모드는 켜고 끄는 값이라 스위치(role="switch")로 둔다
 */
export function AppearanceSettings() {
    const theme = useUiSettingsStore((state) => state.theme);
    const setTheme = useUiSettingsStore((state) => state.setTheme);
    const textScale = useUiSettingsStore((state) => state.textScale);
    const setTextScale = useUiSettingsStore((state) => state.setTextScale);
    const isLargeText = textScale === 'large';

    return (
        <section className="bg-surface-page border-border-default flex flex-col gap-5 rounded-2xl border p-6 shadow-md">
            <div className="flex flex-col gap-1">
                <h2 className="text-title-3 text-fg-primary">화면 설정</h2>
                <p className="text-body-sm text-fg-tertiary">
                    글자 크기와 화면 색을 바꿀 수 있어요.
                </p>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <p className="text-body-bold text-fg-primary">테마</p>
                    <p className="text-body-sm text-fg-tertiary">화면 색상 모드를 선택해요.</p>
                </div>
                <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                    <SelectTrigger className="h-9 w-32" aria-label="테마 선택">
                        <SelectValue />
                    </SelectTrigger>
                    {/* 목록은 상자 바로 아래에 고정해 연다 — 기본(고른 항목을 상자에 맞춤)은 고른 값마다 목록 위치가 달라 흔들려 보인다 */}
                    <SelectContent position="popper" align="end">
                        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                            <SelectItem key={value} value={value} className="gap-2">
                                {/* 아이콘마다 그림 폭이 달라 같은 칸(16)에 가운데 맞춰 글자 시작선을 맞춘다 */}
                                <Icon className="size-4 shrink-0" />
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <p id="large-text-label" className="text-body-bold text-fg-primary">
                        큰글씨 모드
                    </p>
                    <p className="text-body-sm text-fg-tertiary">전체 글자 크기를 크게 표시해요.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={isLargeText}
                    aria-labelledby="large-text-label"
                    onClick={() => setTextScale(isLargeText ? 'normal' : 'large')}
                    className={cn(
                        'focus-visible:ring-border-focus focus-visible:ring-offset-surface-page relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                        isLargeText ? 'bg-action-neutral' : 'bg-border-strong',
                    )}
                >
                    <span
                        aria-hidden
                        className={cn(
                            'bg-surface-page absolute top-0.5 left-0.5 size-5 rounded-full shadow-sm transition-transform',
                            isLargeText && 'translate-x-4',
                        )}
                    />
                </button>
            </div>
        </section>
    );
}
