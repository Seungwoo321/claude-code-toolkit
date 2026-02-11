---
name: jira
description: Jira Cloud 티켓 관리. 조회/목록/상태변경/할당/코멘트/브랜치생성/내용작성 지원
argument-hint: "[조회|목록|상태|할당|코멘트|브랜치|작성] [티켓번호|옵션]"
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
| `목록 --스프린트 "이름"` | 특정 스프린트 | `list-issues.ts --sprint "AIR Studio_Sprint_8"` |
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
| `설정` | 환경 설정 조회 (대화형) | 아래 "설정 워크플로우" 참조 |
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

인수가 없거나 "조회"인 경우:

```bash
npx tsx $SCRIPTS/get-issue.ts --from-branch
```

**결과 포맷팅** (LLM이 JSON을 읽기 쉬운 형태로 변환):

```markdown
## AS-1234: 티켓 제목

**상태**: 진행중 | **담당자**: 이승우 | **유형**: Story
**상위**: AS-1000 (에픽 제목)

### 설명
(설명 내용 또는 "설명 없음")

### 하위 작업
- [ ] AS-1235: 서브태스크 1 (To Do)
- [x] AS-1236: 서브태스크 2 (Done)

### 최근 코멘트
> **이수민** (2026-01-16 14:30)
> 코멘트 내용...

🔗 https://mzdevs.atlassian.net/browse/AS-1234
```

### 2. 목록

```bash
# 내 담당
npx tsx $SCRIPTS/list-issues.ts --mine

# 담당자별
npx tsx $SCRIPTS/list-issues.ts --assignee "이승우"

# 빈 티켓
npx tsx $SCRIPTS/list-issues.ts --empty

# 상태별
npx tsx $SCRIPTS/list-issues.ts --status "In Progress"

# 현재 스프린트
npx tsx $SCRIPTS/list-issues.ts --sprint current

# 특정 스프린트
npx tsx $SCRIPTS/list-issues.ts --sprint "AIR Studio_Sprint_8"

# 백로그 (스프린트 미할당)
npx tsx $SCRIPTS/list-issues.ts --backlog

# 스프린트 목록 조회
npx tsx $SCRIPTS/list-sprints.ts
```

**결과 포맷팅 (트리 형식)**:

여러 스프린트가 있는 경우 스프린트별로 구분하여 출력:

```
📋 티켓 목록 (12건)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏃 AIR Studio_Sprint_8 (8건)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🔄 진행중 (3건)
  ├─ AS-1234: 기능 개발 👤 이승우
  │  ├─ 🔄 AS-1235: 서브태스크 1 (진행중)
  │  └─ ⬜ AS-1236: 서브태스크 2 (할일)
  └─ AS-1237: 버그 수정 👤 이수민

  ⬜ 해야 할 일 (5건)
  ├─ AS-1240: 새 기능
  └─ AS-1241: 리팩토링

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏃 AIR Studio_Sprint_9 (4건)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ⬜ 해야 할 일 (4건)
  └─ AS-1250: 다음 스프린트 작업

범례: ✅ 완료 | 🔄 진행중 | ⬜ 할일 | 👀 리뷰 | ❌ DROP | 👤 담당자
```

단일 스프린트인 경우 스프린트 헤더 없이 출력:

```
📋 티켓 목록 (8건)

🔄 진행중 (3건)
├─ AS-1234: 기능 개발 👤 이승우
│  ├─ 🔄 AS-1235: 서브태스크 1 (진행중)
│  └─ ⬜ AS-1236: 서브태스크 2 (할일)
└─ AS-1237: 버그 수정 👤 이수민

⬜ 해야 할 일 (5건)
├─ AS-1240: 새 기능
└─ AS-1241: 리팩토링

범례: ✅ 완료 | 🔄 진행중 | ⬜ 할일 | 👀 리뷰 | ❌ DROP | 👤 담당자
```

### 3. 상태 변경

```bash
# 현재 브랜치 티켓
npx tsx $SCRIPTS/update-issue.ts --from-branch --status "In Progress"

# 특정 티켓
npx tsx $SCRIPTS/update-issue.ts AS-1234 --status "Done"
```

**변경 전 확인 필수**: 상태 변경 전 현재 상태를 사용자에게 알려주고, 변경 후 결과 표시.

```markdown
✅ AS-1234 상태 변경 완료
   To Do → In Progress

🔗 https://mzdevs.atlassian.net/browse/AS-1234
```

### 4. 할당

```bash
npx tsx $SCRIPTS/update-issue.ts --from-branch --assignee "이수민"
npx tsx $SCRIPTS/update-issue.ts AS-1234 --assignee "이재준"
```

**결과**:

```markdown
✅ AS-1234 담당자 변경 완료
   이승우 → 이수민

🔗 https://mzdevs.atlassian.net/browse/AS-1234
```

### 5. 코멘트

```bash
npx tsx $SCRIPTS/add-comment.ts --from-branch "작업 내용 기록"
npx tsx $SCRIPTS/add-comment.ts AS-1234 "코드 리뷰 완료"
```

**코멘트 작성 규칙**:
- 코드, 파일명, 경로는 백틱으로 감싸기: \`Button.tsx\`
- 마크다운 링크 형식 피하기 (Trello와 동일)
- 코드 예시나 수정 파일 목록은 포함하지 않기
- 간결하고 명확하게 요약

**결과**:

```markdown
✅ AS-1234에 코멘트 추가됨

🔗 https://mzdevs.atlassian.net/browse/AS-1234
```

### 5-1. 코멘트 템플릿

작업 유형별 권장 코멘트 구조:

**기능 개선 / 버그 수정**:
```markdown
## 작업 내용

(한 줄 요약)

### 배경
- 기존: (이전 상태)
- 문제: (발생한 문제)
- 해결: (해결 방법)

### 결과
- (개선된 점 1)
- (개선된 점 2)
```

**리팩토링**:
```markdown
## 작업 내용

(한 줄 요약)

### 주요 변경 사항
- (변경 1)
- (변경 2)

### 결과
- (개선 효과)
```

**조사/분석**:
```markdown
## 분석 결과

### 현황
- (현재 상태 요약)

### 발견 사항
- (발견 1)
- (발견 2)

### 권장 조치
- (조치 1)
- (조치 2)
```

### 6. 서브태스크 생성

```bash
npx tsx $SCRIPTS/create-subtask.ts AS-1234 "서브태스크 제목" --assignee "이승우"
```

**결과**:

```markdown
✅ AS-1235 생성됨 (상위: AS-1234)

🔗 https://mzdevs.atlassian.net/browse/AS-1235
```

### 7. 필드 업데이트 (추정치)

```bash
npx tsx $SCRIPTS/update-fields.ts AS-1234 --estimate 2h
npx tsx $SCRIPTS/update-fields.ts AS-1234 --estimate 1d
```

**추정치 형식**:
- `1h`, `2h`, `30m` - 시간/분
- `1d`, `2d` - 일
- `1w` - 주

**결과**:

```markdown
✅ AS-1234 추정치 설정: 2h

🔗 https://mzdevs.atlassian.net/browse/AS-1234
```

**참고**: 시작일(`--start-date`)은 프로젝트 설정에 따라 API로 설정 불가능할 수 있음

### 8. 브랜치 생성

티켓 정보를 기반으로 Git 브랜치를 자동 생성합니다.

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

**결과**:

```markdown
✅ 브랜치 생성 완료
   refactor/AS-1234/deploy-config-sync

   티켓: AS-1234 - 딜리버리 설정 동기화
   이전 브랜치: sprint/20260220

🔗 https://mzdevs.atlassian.net/browse/AS-1234
```

### 9. 작성 (대화형)

"작성" 명령 시 LLM이 사용자와 대화하며 티켓 내용을 구성합니다.

**워크플로우**:

1. **현재 티켓 정보 조회**
   ```bash
   npx tsx $SCRIPTS/get-issue.ts --from-branch
   ```

2. **현재 상태 분석 및 안내**
   ```markdown
   ## AS-1234 티켓 분석

   **제목**: 로그인 기능 개선
   **현재 설명**: (비어있음)
   **하위 작업**: 없음

   이 티켓의 내용을 작성하겠습니다. 어떻게 진행할까요?

   1. **자동 작성**: 현재 대화/컨텍스트 기반으로 내용 생성
   2. **수동 입력**: 직접 내용 입력
   3. **정보 추가**: 관련 정보 더 제공
   ```

3. **내용 구성** (사용자 선택에 따라)
   - Acceptance Criteria 작성
   - 기술 요구사항 정리
   - 하위 작업 분해 제안

4. **최종 확인 후 업데이트**
   - 사용자 확인 후 Jira API로 업데이트
   - (현재 버전에서는 수동 복사 안내)

## 에러 처리

| 에러 코드 | 설명 | 해결 방법 |
|-----------|------|-----------|
| `AUTH_MISSING` | 환경 변수 없음 | `export JIRA_EMAIL=...; export JIRA_API_TOKEN=...` |
| `AUTH_INVALID` | 인증 실패 | API 토큰 확인 |
| `TICKET_NOT_FOUND` | 티켓 없음 | 티켓 번호 확인 |
| `BRANCH_NO_TICKET` | 브랜치에 티켓 없음 | `feature/AS-1234/desc` 형식 사용 |
| `INVALID_TRANSITION` | 상태 전환 불가 | 가능한 전환 상태 확인 |

## 팀원 정보

config.json에 정의된 팀원:
- 이승우 (swlee, 승우)
- 이수민 (sumin, 수민)
- 조현아 (hyunah, 현아)
- 이재준 (jaejun, 재준)

이름 또는 별칭으로 담당자 지정 가능.

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

## 설정 워크플로우

"설정" 명령 시 LLM이 현재 Jira 환경을 분석하고 config.json을 구성합니다.

### 환경 정보 조회

```bash
# 전체 환경 조회
npx tsx $SCRIPTS/get-config.ts

# 보드 목록만
npx tsx $SCRIPTS/get-config.ts --boards

# 필드 목록만
npx tsx $SCRIPTS/get-config.ts --fields

# 이슈 타입만
npx tsx $SCRIPTS/get-config.ts --issue-types
```

### 설정 초기화/업데이트

```bash
# 사이트/프로젝트 설정
npx tsx $SCRIPTS/init-config.ts --site "https://xxx.atlassian.net" --project AS

# 인증 설정
npx tsx $SCRIPTS/init-config.ts --auth "email@example.com" "api-token"

# 보드 추가
npx tsx $SCRIPTS/init-config.ts --add-board 4933 "AS 보드"

# 필드 매핑 추가
npx tsx $SCRIPTS/init-config.ts --add-field startDate customfield_11802
npx tsx $SCRIPTS/init-config.ts --add-field storyPoints customfield_11804

# 현재 설정 표시
npx tsx $SCRIPTS/init-config.ts --show
```

### 대화형 설정 워크플로우

1. **현재 환경 조회**
   ```bash
   npx tsx $SCRIPTS/get-config.ts
   ```

2. **상태 분석 및 안내**
   ```markdown
   ## Jira 설정 분석

   **프로젝트**: AS (AIR Studio)
   **보드**: AS 보드 (id: 4933)

   ### 활성 스프린트
   - AIR Studio_Sprint_8 (02/09 ~ 02/19)

   ### 이슈 타입
   - 에픽, 스토리, 작업, 하위 작업, 버그

   ### 사용 가능한 필드
   | 필드 | ID | 타입 |
   |------|------|------|
   | 시작일 | customfield_11802 | date |
   | 스토리 포인트 | customfield_11804 | number |
   | 스프린트 | customfield_10007 | array |

   설정을 업데이트하시겠습니까?
   ```

3. **사용자 선택에 따라 config.json 업데이트**

### 필드 매핑

AS 프로젝트 주요 커스텀 필드:

| 필드 | ID | 용도 |
|------|------|------|
| Sprint | customfield_10007 | 스프린트 할당 |
| Start date | customfield_11802 | 시작일 |
| Story point estimate | customfield_11804 | 스토리 포인트 |

config.json에 매핑 설정:

```json
"fields": {
  "mapping": {
    "sprint": "customfield_10007",
    "startDate": "customfield_11802",
    "storyPoints": "customfield_11804"
  }
}
```
