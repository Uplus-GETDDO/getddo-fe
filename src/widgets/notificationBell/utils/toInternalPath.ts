/**
 * 서버가 주는 linkUrl 중 앱 내부 경로만 돌려준다.
 * '//'로 시작하는 프로토콜 상대 URL은 브라우저가 외부 출처로 해석하므로 제외한다
 */
export function toInternalPath(linkUrl: string | null): string | null {
    // 역슬래시·제어 문자는 URL 파서가 슬래시로 바꾸거나 지워 외부 출처로 해석될 수 있어 거부한다
    if (!linkUrl?.startsWith('/') || linkUrl.startsWith('//') || /[\p{Cc}\\]/u.test(linkUrl)) {
        return null;
    }
    return linkUrl;
}
