---
name: jira
description: Jira Cloud 티켓 관리. 조회/목록/상태변경/할당/코멘트/브랜치생성/내용작성 지원. Use when user mentions "jira", "티켓", "이슈", "스프린트", "할당", "백로그", or asks to "check ticket", "view sprint", "change status", "assign to", or references Jira ticket numbers like AS-1234, PROJ-567.
argument-hint: "[조회|목록|상태|할당|코멘트|브랜치|작성] [티켓번호|옵션]"
metadata:
  author: Seungwoo, Lee
  version: 1.0.0
---

# Jira 티켓 관리

Jira Cloud 티켓을 조회, 관리, 업데이트합니다.

## 스크립트 경로

```
SCRIPTS=~/.claude/skills/jira/scripts
```

## 현재 컨텍스트 확인

현재 브랜치에서 티켓 정보를 자동으로 추출합니다:

```bash
# 현재 브랜치
git branch --show-current 2>/dev/null || echo "(no branch)"

# 티켓 번호 추출
npx tsx $SCRIPTS/parse-branch.ts 2>/dev/null | jq -r '.ticket // "없음"'
```

## 인수 처리

사용자 입력: `$ARGUMENTS`

### 명령어 매핑

| 사용자 입력 | 동작 | 스크립트 호출 |
|-------------|------|---------------|
| (없음) | 현재 브랜치 티켓 조회 | `get-issue.ts --from-branch` |
| `조회` | 현재 브랜치 티켓 조회 | `get-issue.ts --from-branch` |
| `조회 AS-1234` | 특정 티켓 조회 | `get-issue.ts AS-1234` |
| `목록` | 내 담당 티켓 | `list-issues.ts --mine` |
| `목록 --담당자 이름` | 담당자별 | `list-issues.ts --assignee "이름"` |
| `목록 --빈티켓` | 설명 없는 티켓 | `list-issues.ts --empty` |
| `목록 --상태 진행중` | 상태별 | `list-issues.ts --status "In Progress"` |
| `목록 --스프린트` | 현재 스프린트 (트리 형식) | `list-issues.ts --sprint current` |
| `목록 --스프린트 "이름"` | 특정 스프린트 | `list-issues.ts --sprint "Sprint_8"` |
| `목록 --스프린트 --상태 진행중` | 스프린트 + 상태 필터 | `list-issues.ts --sprint current --status "In Progress"` |
| `목록 --스프린트 --json` | JSON 형식 출력 | `list-issues.ts --sprint current --json` |
| `목록 --백로그` | 백로그 (미할당, 트리 형식) | `list-issues.ts --backlog` |
| `스프린트` | 스프린트 목록 조회 | `list-sprints.ts` |
| `상태 진행중` | 현재 티켓 상태 변경 | `update-issue.ts --from-branch --status "In Progress"` |
| `상태 AS-1234 완료` | 특정 티켓 상태 변경 | `update-issue.ts AS-1234 --status "Done"` |
| `할당 이름` | 현재 티켓 할당 | `update-issue.ts --from-branch --assignee "이름"` |
| `할당 AS-1234 이름` | 특정 티켓 할당 | `update-issue.ts AS-1234 --assignee "이름"` |
| `코멘트 "내용"` | 현재 티켓 코멘트 | `add-comment.ts --from-branch "내용"` |
| `코멘트 AS-1234 "내용"` | 특정 티켓 코멘트 | `add-comment.ts AS-1234 "내용"` |
| `작성` | 티켓 내용 작성 (대화형) | 아래 "작성 워크플로우" 참조 |
| `서브태스크 AS-1234 "제목"` | 하위 작업 생성 | `create-subtask.ts AS-1234 "제목" --assignee "이름"` |
| `추정 AS-1234 2h` | 추정치 설정 | `update-fields.ts AS-1234 --estimate 2h` |
| `브랜치 AS-1234 설명` | 티켓 기반 브랜치 생성 | `create-branch.ts AS-1234 "설명"` |
| `설정` | 환경 설정 조회 (대화형) | [setup-workflow.md](references/setup-workflow.md) 참조 |
| `설정 --보드` | 보드 목록 조회 | `get-config.ts --boards` |
| `설정 --필드` | 필드 목록 조회 | `get-config.ts --fields` |

### 상태 매핑 (한국어 → Jira)

| 입력 | Jira 상태 |
|------|-----------|
| `할일`, `todo`, `시작전` | To Do |
| `진행`, `진행중`, `시작` | In Progress |
| `리뷰`, `검토`, `코드리뷰` | In Review |
| `완료`, `done`, `종료` | Done |

## 실행 절차

### 1. 조회 (기본)

```bash
npx tsx $SCRIPTS/get-issue.ts --from-branch
```

### 2. 목록

```bash
npx tsx $SCRIPTS/list-issues.ts --mine          # 내 담당
npx tsx $SCRIPTS/list-issues.ts --sprint current # 현재 스프린트
npx tsx $SCRIPTS/list-issues.ts --backlog        # 백로그
```

### 3. 상태 변경

```bash
npx tsx $SCRIPTS/update-issue.ts --from-branch --status "In Progress"
npx tsx $SCRIPTS/update-issue.ts AS-1234 --status "Done"
```

**변경 전 확인 필수**: 상태 변경 전 현재 상태를 사용자에게 알려주고, 변경 후 결과 표시.

### 4. 할당

```bash
npx tsx $SCRIPTS/update-issue.ts --from-branch --assignee "이름"
npx tsx $SCRIPTS/update-issue.ts AS-1234 --assignee "이름"
```

### 5. 코멘트

```bash
npx tsx $SCRIPTS/add-comment.ts --from-branch "작업 내용 기록"
npx tsx $SCRIPTS/add-comment.ts AS-1234 "코드 리뷰 완료"
```

코멘트 템플릿은 [comment-templates.md](references/comment-templates.md) 참조.

### 6. 서브태스크 생성

```bash
npx tsx $SCRIPTS/create-subtask.ts AS-1234 "서브태스크 제목" --assignee "이름"
```

### 7. 필드 업데이트 (추정치)

```bash
npx tsx $SCRIPTS/update-fields.ts AS-1234 --estimate 2h
npx tsx $SCRIPTS/update-fields.ts AS-1234 --estimate 1d
```

**추정치 형식**: `1h`, `2h`, `30m` (시간/분), `1d`, `2d` (일), `1w` (주)

### 8. 브랜치 생성

```bash
npx tsx $SCRIPTS/create-branch.ts AS-1234 "deploy-config-sync"
```

**prefix 자동 결정 규칙**:
| 조건 | prefix |
|------|--------|
| 이슈 타입이 Bug/버그 | `bugfix/` |
| 상위/본인이 리팩토링 포함 | `refactor/` |
| 우선순위 Highest 또는 hotfix/긴급 포함 | `hotfix/` |
| 그 외 | `feature/` |

### 9. 작성 (대화형)

"작성" 명령 시 LLM이 사용자와 대화하며 티켓 내용을 구성합니다.

**워크플로우**:

1. 현재 티켓 정보 조회: `npx tsx $SCRIPTS/get-issue.ts --from-branch`
2. 현재 상태 분석 및 안내 (자동/수동/추가 정보 선택)
3. 내용 구성 (Acceptance Criteria, 기술 요구사항, 하위 작업)
4. 최종 확인 후 업데이트

## 에러 처리

| 에러 코드 | 설명 | 해결 방법 |
|-----------|------|-----------|
| `AUTH_MISSING` | 환경 변수 없음 | `export JIRA_EMAIL=...; export JIRA_API_TOKEN=...` |
| `AUTH_INVALID` | 인증 실패 | API 토큰 확인 |
| `TICKET_NOT_FOUND` | 티켓 없음 | 티켓 번호 확인 |
| `BRANCH_NO_TICKET` | 브랜치에 티켓 없음 | `feature/AS-1234/desc` 형식 사용 |
| `INVALID_TRANSITION` | 상태 전환 불가 | 가능한 전환 상태 확인 |

## 팀원 정보

config.json에 정의된 팀원 이름 또는 별칭으로 담당자 지정 가능.

## 브랜치 규칙

**권장 형식**: `feature/AS-1234/short-description`

```
feature/AS-1234/login-improvement
bugfix/AS-1235/fix-validation
hotfix/AS-1236/critical-fix
chore/AS-1237/update-deps
```

- 슬래시(/)로 티켓 번호와 설명 구분
- 설명은 영어로 작성 (한글 불가)
- Jira에서 브랜치 생성 시 자동 연결됨

## 참조 문서

- [코멘트 템플릿](references/comment-templates.md)
- [설정 워크플로우](references/setup-workflow.md)
- [출력 포맷](references/output-formats.md)
