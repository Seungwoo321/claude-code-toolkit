---
name: trello
description: Claude Code 세션을 Trello 카드와 연동합니다. 세션 생성/연결/상태변경/기록. Use when user mentions "trello", "카드", "세션 기록", "작업 추적", "작업 저장", or asks to "save session", "create card", "track progress", "기록 남겨", "작업 완료 처리".
argument-hint: "[create|connect|comment|title|pause|done|stale|list|sync|archive|locks|unlock|info]"
metadata:
  author: Seungwoo, Lee
  version: 3.5.0
---

# Trello 세션 관리

Claude Code 세션을 Trello 카드와 연동합니다.

## 현재 세션 정보

- 세션 ID: !`ls -t ~/.claude/projects/$(pwd | sed 's|/|-|g')/*.jsonl 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/.jsonl//'`
- 매핑 확인: !`cat ~/.claude-trello/sessions/$(ls -t ~/.claude/projects/$(pwd | sed 's|/|-|g')/*.jsonl 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/.jsonl//').json 2>/dev/null || echo "매핑 없음"`

## 인수 처리

사용자 입력: `$ARGUMENTS`

| 인수 | 동작 |
|------|------|
| (없음) | 연결 시도 → 없으면 새 카드 생성 |
| `create` | 대화 분석 후 자동 요약으로 새 카드 생성 |
| `connect` | 카드 목록 표시 후 연결 |
| `comment` | 현재 작업 내용을 코멘트로 추가 |
| `title` | 카드 제목 변경 (대화 분석 후 자동 생성) |
| `pause` | 상태를 paused로 변경 |
| `done` | 상태를 done으로 변경 |
| `stale` | 상태를 stale로 변경 |
| `list` | 전체 카드 목록 |
| `sync` | 트렐로 기준 로컬 세션 동기화 + 미확인 상태 감지 |
| `archive <카드ID>` | 카드 아카이브 처리 |
| `locks` | 활성 Lock 파일 목록 |
| `unlock` | 현재 세션 Lock 해제 |
| `info` | 현재 세션/카드 정보 |

## 실행 절차

### 1. 인수가 없거나 "connect"인 경우

```bash
~/.claude-trello/trello-session.sh connect
```

연결 실패 시 → "create" 절차로 진행

### 2. "create"인 경우

1. 현재까지의 대화 내용을 분석
2. 작업 요약을 자동 생성 (사용자에게 물어보지 말 것!)
3. 카드 생성:
```bash
~/.claude-trello/trello-session.sh init "자동생성된요약"
```

### 3. "comment"인 경우

1. 현재까지의 대화에서 주요 작업 내용 분석
2. 코멘트 추가:
```bash
~/.claude-trello/trello-session.sh comment "분석된 작업 내용"
```

### 4. "title"인 경우

1. 현재까지의 대화에서 작업 주제/목적 분석
2. 제목 변경:
```bash
~/.claude-trello/trello-session.sh title "분석된 작업 주제"
```

### 5. "pause"인 경우

```bash
~/.claude-trello/trello-session.sh status paused
```

### 6. "done"인 경우

```bash
~/.claude-trello/trello-session.sh status done
```

### 7. "stale"인 경우

```bash
~/.claude-trello/trello-session.sh status stale
```

### 8. "list"인 경우

```bash
~/.claude-trello/trello-session.sh list
```

### 9. "sync"인 경우

```bash
~/.claude-trello/trello-session.sh sync
```

### 10. "archive"인 경우

인수에서 카드 ID 추출 후:
```bash
~/.claude-trello/trello-session.sh archive <카드ID>
```

### 11. "locks"인 경우

```bash
~/.claude-trello/trello-session.sh locks
```

### 12. "unlock"인 경우

```bash
~/.claude-trello/trello-session.sh unlock
```

### 13. "info"인 경우

```bash
~/.claude-trello/trello-session.sh info
```

## 핵심 규칙

1. **요약/제목은 절대 사용자에게 물어보지 말 것** - 대화 내용을 분석하여 자동 생성
2. **세션 ID가 다르면 다른 카드** - 매핑 파일이 있을 때만 자동 연결
3. **카드 생성 시 포함할 정보**:
   - 프로젝트명 (현재 디렉토리)
   - 작업 요약 (대화 분석)
   - 세션 ID
4. **제목은 간결하게** - `[프로젝트명] 핵심 작업 내용` 형식 유지

## Lock 파일 기반 상태 추적

- 세션 연결 시 `~/.claude-trello/locks/{세션ID}.lock` 자동 생성
- `sync` 실행 시 Lock 없는 진행중 카드 → stale 상태로 이동
- 강제 종료된 세션 감지 가능

## 상태 목록

| 상태 | 설명 |
|------|------|
| 🔴 urgent | 긴급 작업 |
| 🟡 in_progress | 현재 작업 중 |
| 🟢 paused | 일시 중단 |
| 🟠 stale | Lock 없이 종료된 세션 (미확인) |
| ✅ done | 작업 완료 |

## 코멘트 작성 규칙

Trello는 마크다운을 지원하며, 특정 패턴을 자동으로 링크로 변환합니다.

### 자동 링크 방지

파일명이나 경로를 작성할 때 **반드시 백틱(\`)으로 감싸야 합니다**:

| 잘못된 예 | 올바른 예 |
|----------|----------|
| `docs/parser/00-design-specification.md` | \`00-design-specification\` |
| `src/components/Button.tsx` | \`Button.tsx\` |
| `/api/users` | \`/api/users\` |

### 이유

- `.md`, `.tsx`, `.ts` 등 확장자가 있는 파일명은 Trello가 링크로 자동 변환
- `/`가 포함된 경로도 URL로 인식될 수 있음
- 백틱으로 감싸면 인라인 코드로 처리되어 링크 변환 방지

### 권장 형식

```
### 수정 파일 (경로: src/components)
- \`Button.tsx\`
- \`Input.tsx\`
- \`Modal.tsx\`
```
