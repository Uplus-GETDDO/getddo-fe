import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { queryClient } from '@shared/api/queryClient';
import { useUiSettingsStore } from '@shared/model/uiSettings';
import { VirtualClockProvider } from '@shared/model/virtualClock';
import { Toaster } from '@shared/ui/sonner';

import { router } from '../routes';

// 큰글씨 모드 — 스토어 값을 html data-text-scale 속성에 동기화 (globals.css에서 스케일 적용)
function TextScaleSync() {
    const textScale = useUiSettingsStore((state) => state.textScale);

    useEffect(() => {
        document.documentElement.dataset.textScale = textScale;
    }, [textScale]);

    return null;
}

// 테마 — 스토어 값을 html .dark 클래스에 동기화한다. 'system'은 OS 설정을 따라간다
function ThemeSync() {
    const theme = useUiSettingsStore((state) => state.theme);

    useEffect(() => {
        const root = document.documentElement;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
            const dark = theme === 'dark' || (theme === 'system' && mq.matches);
            root.classList.toggle('dark', dark);
        };
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [theme]);

    return null;
}

export function AppProviders() {
    return (
        <QueryClientProvider client={queryClient}>
            <VirtualClockProvider>
                <ThemeSync />
                <TextScaleSync />
                <RouterProvider router={router} />
                <Toaster richColors position="top-center" />
            </VirtualClockProvider>
        </QueryClientProvider>
    );
}
