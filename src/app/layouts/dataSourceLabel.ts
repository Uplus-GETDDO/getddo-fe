import type { DataSource } from '../config/dataSource';

/** 바닥글의 데이터 출처 문구 — 실사용자에게는 눈에 띄지 않게, 포트폴리오로 보는 사람은 확인할 수 있게 한 줄로 */
export const DATA_SOURCE_LABEL: Record<DataSource, string> = {
    live: '실서버 데이터',
    mock: '예시 데이터 · 서버 연결 없음',
};
