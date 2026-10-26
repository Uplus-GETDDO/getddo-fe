# 공개 진입점·문서·로컬 검사 정리 계획

> 사용자가 2026-10-26 점검 항목 1~4의 실행을 승인했다. 실행은 executing-plans 스킬로 순서대로 수행하며 문서·검사 설정·공개 진입점만 변경한다.

**목표:** GitHub 기본 화면에 최신 README를 제공하고 조직 소개·공용 문서·로컬 검사 범위를 현재 상태로 맞춘다.

**구조:** FE 변경을 dev PR로 통합한 뒤 dev → main 릴리스 PR을 만든다. main의 기존 고유 커밋은 머지 커밋으로 보존한다. 공용 명세는 저장소 규칙대로 main에 직접 반영하며 조직 소개는 별도 PR로 반영한다.

**기술:** 기존 Markdown, GitHub CLI, ESLint, Prettier, Vitest 설정만 사용한다.

**요청 기준:** 직전 점검의 1) 기본 브랜치 반영 2) 조직 소개·About·Topics 3) 상세 문서 정합화 4) 로컬 작업트리 검사 제외를 실행한다. 코드 리팩터링과 미확정 업무 정책 변경은 제외한다.

## 변경 파일과 책임

| 저장소·파일                                                    | 책임                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| FE docs/CONTEXT.md                                             | 현재 진입점·삭제된 사용자 화면·부팅 코드 위치·배포/과거 기록 경계·GitHub 명세 링크 갱신 |
| FE .gitignore, .prettierignore                                 | 로컬 .claude-worktrees 폴더를 Git·포맷 검사에서 제외                                    |
| FE eslint.config.js                                            | 로컬 작업트리의 복제 코드를 lint 대상에서 제외                                          |
| FE vitest.config.ts                                            | configDefaults.exclude를 유지하며 로컬 작업트리만 테스트 수집에서 제외                  |
| FE CONTRIBUTING.md                                             | 검사 제외의 목적·범위와 기존 검증 명령 안내                                             |
| 공용 명세 05-api/README.md                                     | 도메인별 채택·구현·배포를 구분하고 AP05/AP06·AM05·AO09 등 색인 갱신                     |
| 공용 명세 04-worklogs/2026-10-26-public-entrypoint-followup.md | 정책을 바꾸지 않은 문서 정리 기록                                                       |
| 조직 profile/README.md                                         | 실제 서비스·현재 스택·공개 명세 저장소 안내                                             |
| GitHub FE·조직 저장소 소개                                     | 기존 Website를 보존하고 Description·Topics 설정                                         |

## 작업과 검증

- [ ] 문서·목업·배포 설정과 현재 원격 main/dev 상태를 대조한다.
- [ ] FE 문서와 네 검사 설정을 최소 변경하고 기본 제외 목록을 유지한다.
- [ ] Vitest 수집 목록에 기존 144개 테스트 파일이 남고 .claude-worktrees가 포함되지 않는지 확인한다.
- [ ] git check-ignore와 ESLint isPathIgnored로 제외 동작을 확인한다.
- [ ] 공용 명세 색인과 조직 프로필을 갱신하고 로컬·저장소 간 링크를 검증한다.
- [ ] format:check·lint·test:ci·build·perf:budget을 수행한다. 기존 사용자 미추적 문서 경고는 임의 수정하지 않고 구분한다.
- [ ] 독립 검토 후 FE dev PR·조직 main PR을 생성하고 CI를 확인해 반영한다.
- [ ] 공용 명세 main 문서 커밋과 GitHub Description·Topics를 반영한다.
- [ ] dev → main 릴리스 PR의 전체 범위·CI·충돌 여부를 확인하고 머지 커밋으로 두 이력을 보존한다.
- [ ] main에서 최신 README와 캡처 5장이 보이며 머지 후 CI가 통과하는지 확인한다.
- [ ] 작업 브랜치를 정리하고 기존 사용자 삭제·미추적 상태를 보존한다.

## 제약과 되돌리기

- 기존 사용자 삭제 중인 BE 요청 파일과 미추적 시연 시나리오는 커밋하지 않는다.
- .claude-worktrees의 실제 파일은 이동·삭제하지 않는다. 현재 src와 scripts 테스트는 계속 수집한다.
- 린트 규칙·테스트 단언·품질 임계값·업무 코드·의존성은 변경하지 않는다.
- 릴리스는 force push·reset 없이 PR로 반영한다. 문제가 생기면 해당 PR 또는 머지 커밋을 되돌리는 별도 PR로 복구한다.
- GitHub 소개 설정은 변경 전 값을 기록하고 필요하면 같은 필드만 되돌린다.
