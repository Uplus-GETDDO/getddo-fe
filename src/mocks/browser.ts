import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

// 브라우저 목업은 로컬 개발 전용이다 — 배포 빌드는 VITE_ENABLE_MSW=false라 이 모듈이 실행되지 않는다
export const worker = setupWorker(...handlers);
