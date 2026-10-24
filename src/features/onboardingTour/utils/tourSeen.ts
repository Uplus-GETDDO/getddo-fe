/** 안내를 본 표시는 가상 사용자마다 따로 둔다 — 시연 중 다른 사용자로 바꾸면 그 사용자에게는 다시 보인다 */
const seenKey = (userId: string) => `getddo:tour-seen:${userId}`;

/*
 * 저장소를 못 쓰는 환경(사생활 보호 창·차단된 사이트 데이터)에서는 읽기·쓰기가 던질 수 있다.
 * 읽기가 실패하면 '봤다'로 본다 — 안내가 매번 다시 뜨는 쪽이 한 번도 안 뜨는 쪽보다 성가시다
 */
export function hasSeenTour(userId: string, storage: Storage = localStorage): boolean {
    try {
        return storage.getItem(seenKey(userId)) !== null;
    } catch {
        return true;
    }
}

export function markTourSeen(userId: string, storage: Storage = localStorage): void {
    try {
        storage.setItem(seenKey(userId), new Date().toISOString());
    } catch {
        // 저장하지 못해도 이번 방문의 안내는 이미 끝났다
    }
}
