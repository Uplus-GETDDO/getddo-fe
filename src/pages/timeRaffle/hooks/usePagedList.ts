import { useState } from 'react';

/**
 * 한 쪽에 size개씩 넘겨 보는 목록 — 다 들어가면 쪽이 하나라 넘김을 두지 않는다.
 * 목록이 줄어 지금 쪽이 사라지면 마지막 쪽에 맞춘다 (래플은 마감되면 목록에서 빠진다).
 * direction은 마지막으로 넘긴 쪽 — 새 쪽이 그쪽에서 밀려 들어오게 한다
 */
export function usePagedList<T>(items: readonly T[], size: number) {
    const [state, setState] = useState({ page: 0, direction: 1, moved: false });
    const total = Math.max(1, Math.ceil(items.length / size));
    const current = Math.min(state.page, total - 1);
    return {
        items: items.slice(current * size, (current + 1) * size),
        current,
        total,
        direction: state.direction,
        /** 한 번이라도 넘겼는가 — 처음 그릴 때는 움직이지 않는다 */
        moved: state.moved,
        prev: () => setState({ page: Math.max(0, current - 1), direction: -1, moved: true }),
        next: () => setState({ page: Math.min(total - 1, current + 1), direction: 1, moved: true }),
    };
}
