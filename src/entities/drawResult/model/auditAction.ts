// 실행 감사 action 표시 — getddo-spec 05-api/drawing.md '실행 감사 표시 계약(GD-314)'.
// 값 집합은 DRAW_EXECUTE·DRAW_RESUME뿐이며 코드를 표시 문자열로 치환해 저장·반환하지 않는다
export const DRAW_AUDIT_ACTION_LABEL = {
    DRAW_EXECUTE: '추첨 실행',
    DRAW_RESUME: '추첨 재개',
} as const;
