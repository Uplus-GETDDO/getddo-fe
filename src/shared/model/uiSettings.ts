import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TextScale = 'normal' | 'large';
export type Theme = 'system' | 'light' | 'dark';

interface UiSettingsState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    textScale: TextScale;
    setTextScale: (textScale: TextScale) => void;
}

export const useUiSettingsStore = create<UiSettingsState>()(
    persist(
        (set) => ({
            theme: 'light',
            setTheme: (theme) => set({ theme }),
            textScale: 'normal',
            setTextScale: (textScale) => set({ textScale }),
        }),
        { name: 'getddo-ui-settings' },
    ),
);

// next-themes 시절 'theme' 키에 원시 문자열로 저장된 설정을 이 스토어로 옮긴다 (1회 마이그레이션)
const legacyTheme = localStorage.getItem('theme');
if (legacyTheme === 'light' || legacyTheme === 'dark' || legacyTheme === 'system') {
    useUiSettingsStore.setState({ theme: legacyTheme });
    localStorage.removeItem('theme');
}
