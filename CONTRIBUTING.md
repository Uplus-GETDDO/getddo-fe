# 기여 가이드

이 문서는 브랜치 전략, 커밋 컨벤션, PR 절차 등 협업 프로세스의 상세 기준입니다.
공통 규칙의 원본은 공용 명세 저장소 `../getddo-spec/01-conventions/`이며, 충돌 시 원본을 따릅니다.
코드 작성 규칙(FSD, 상태관리, 스타일)은 [AGENTS.md](./AGENTS.md)를 참고하세요.

## 개발 환경 준비

```bash
npm install                      # 의존성 설치 (prepare 스크립트가 husky 훅을 자동 설치)
cp .env.example .env.development # 환경변수 생성 — VITE_VIRTUAL_USERS_JSON은 필수(미설정 시 로그인 안내)
npm run dev                      # 개발 서버 (VITE_ENABLE_MSW=true면 MSW 목업으로 시작. 배포 빌드는 목업 없음)
```

## 브랜치 전략

| 브랜치            | 용도                                               |
| ----------------- | -------------------------------------------------- |
| `main`            | 배포/시연 가능한 안정 버전. 직접 push·커밋 금지    |
| `dev`             | 개발 통합 브랜치. 직접 push·커밋 금지, PR로만 머지 |
| `<타입>/<Jira키>` | 실제 작업 브랜치. `dev`에서 분기                   |

작업 브랜치 생성:

```bash
git checkout dev && git pull origin dev
git checkout -b feat/GD-21        # 타입: feat | fix | refactor | chore | docs
```

- Jira 이슈 키는 **대문자**로 유지한다 (`feat/gd-21` ❌ → `feat/GD-21` ⭕)
- 한 브랜치 = 한 이슈. 여러 이슈를 섞지 않는다

## 커밋 컨벤션

Conventional Commits + 팀 확장 타입. `commit-msg` 훅의 commitlint가 형식을 강제한다.

```
<타입>: <제목>
<타입>(<스코프>): <제목>
```

| 타입                         | 용도                                 |
| ---------------------------- | ------------------------------------ |
| `feat`                       | 새 기능                              |
| `fix`                        | 버그 수정                            |
| `docs`                       | 문서만 변경                          |
| `style`                      | 포맷·세미콜론 등 동작 변경 없는 수정 |
| `refactor`                   | 리팩토링 (기능 변경 없음)            |
| `test`                       | 테스트 추가·수정                     |
| `chore`                      | 설정·의존성·빌드 외 잡무             |
| `design`                     | UI/스타일 변경                       |
| `comment`                    | 주석 추가·수정                       |
| `rename`                     | 파일/변수 이름 변경                  |
| `remove`                     | 코드·파일 삭제                       |
| `!HOTFIX`                    | 긴급 수정                            |
| `build` `ci` `perf` `revert` | 빌드/CI/성능/되돌리기                |

`build` `ci` `perf` `revert`는 공용 원본(`../getddo-spec/01-conventions/commit.md`)에 없는 이 레포의 확장 타입이며, `commitlint.config.js`의 `type-enum`이 허용한다.

예시:

```
feat: 응모 버튼에 멱등키 헤더 적용
fix(ticket): 월 만료일 표시 오류 수정
chore: eslint-plugin-perfectionist로 import 정렬 강제
```

주의: 제목은 소문자 또는 한글로 시작해야 한다 (대문자 시작은 `subject-case` 규칙에 걸림).

## 커밋 전 자동 검사

`pre-commit` 훅이 lint-staged를 실행한다:

- `*.{ts,tsx}` → `eslint --fix` + `prettier --write`
- `*.{json,md,css}` → `prettier --write`

훅에서 실패한 변경은 커밋되지 않으므로, 수정 후 다시 stage·커밋한다.

## PR 절차

1. 작업 브랜치를 push하고 `dev` 대상으로 PR 생성. 제목은 `[타입] Jira이슈키 제목` 형식을 따른다 (예: `[feat] GD-51 사용자 도메인과 조회 기반 구현`) — GitHub 이슈 번호(`#10`)를 Jira 키 대신 쓰지 않는다
2. PR 템플릿(`.github/pull_request_template.md`)의 항목을 모두 채운다 — 관련 이슈, 작업 내용, 테스트 결과, 리뷰 포인트, 체크리스트
3. CI(`format:check` → `lint` → `test:ci` → `build`) 통과 확인
4. 최소 1명 리뷰 승인 후 **Squash and Merge**
5. 머지 후 작업 브랜치 삭제, 로컬 `dev` 업데이트

## 로컬 검증 명령

PR 전에 CI와 동일한 검사를 로컬에서 돌린다:

```bash
npm run format:check
npm run lint
npm run test:ci
npm run build
```

## AI 에이전트와 함께 작업할 때

- 에이전트에게 작업을 시키기 전 `AGENTS.md`를 읽도록 한다 — FSD 규칙, 금지사항, 검증 명령이 들어 있다
- 도메인 판단(멱등키 필요 여부, 시간 규칙 등)이 필요한 작업은 `docs/CONTEXT.md`를 함께 읽게 한다
- Claude Code 사용 시 PR 전에 `fsd-reviewer` 서브에이전트(`.claude/agents/fsd-reviewer.md`)로 교차 검증할 수 있다 — 구현한 에이전트가 아닌 새 컨텍스트의 리뷰어가 도구가 못 잡는 항목을 검수한다
- 에이전트가 만든 변경도 동일하게 lint·CI·리뷰를 거친다
