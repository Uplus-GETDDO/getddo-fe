import { useEffect, useRef, useState } from 'react';

const HIGHLIGHT_MS = 1600;

/**
 * 처음 받은 목록 이후에 새로 생긴 항목 id를 잠깐 동안 돌려준다 — 방금 받은 응모권 내역을 강조할 때 쓴다
 */
export function useFreshIds(ids: string[] | undefined): Set<string> {
    const seen = useRef<Set<string> | null>(null);
    const [fresh, setFresh] = useState<Set<string>>(() => new Set());
    const key = ids?.join('|');

    // 배열 참조가 아닌 내용(key)이 바뀔 때만 비교하도록 key에서 목록을 다시 만든다
    useEffect(() => {
        if (key == null) return;
        const ids = key === '' ? [] : key.split('|');
        if (!seen.current) {
            seen.current = new Set(ids);
            return;
        }
        const added = ids.filter((id) => !seen.current?.has(id));
        ids.forEach((id) => seen.current?.add(id));
        if (added.length === 0) return;
        setFresh(new Set(added));
        const timer = setTimeout(() => setFresh(new Set()), HIGHLIGHT_MS);
        return () => clearTimeout(timer);
    }, [key]);

    return fresh;
}
