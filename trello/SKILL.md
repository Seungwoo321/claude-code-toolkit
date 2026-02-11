---
name: trello
description: Claude Code 세션을 Trello 카드와 연동합니다. 세션 생성/연결/상태변경/기록
argument-hint: "[생성|연결|기록|제목|일시정지|완료|목록]"
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
| `생성` | 대화 분석 후 자동 요약으로 새 카드 생성 |
| `연결` | 카드 목록 표시 후 연결 |
| `기록` | 현재 작업 내용을 코멘트로 추가 |
| `제목` | 카드 제목 변경 (대화 분석 후 자동 생성) |
| `일시정지` | 상태를 paused로 변경 |
| `완료` | 상태를 done으로 변경 |
| `목록` | 전체 카드 목록 |

## 실행 절차

### 1. 인수가 없거나 "연결"인 경우

```bash
~/.claude-trello/trello-session.sh connect
```

연결 실패 시 → "생성" 절차로 진행

### 2. "생성"인 경우

1. 현재까지의 대화 내용을 분석
2. 작업 요약을 자동 생성 (사용자에게 물어보지 말 것!)
3. 카드 생성:
```bash
~/.claude-trello/trello-session.sh init "자동생성된요약"
```

### 3. "기록"인 경우

1. 현재까지의 대화에서 주요 작업 내용 분석
2. 코멘트 추가:
```bash
~/.claude-trello/trello-session.sh comment "분석된 작업 내용"
```

### 4. "제목"인 경우

1. 현재까지의 대화에서 작업 주제/목적 분석
2. 제목 변경:
```bash
~/.claude-trello/trello-session.sh title "분석된 작업 주제"
```

### 5. "일시정지"인 경우

```bash
~/.claude-trello/trello-session.sh status paused
```

### 6. "완료"인 경우

```bash
~/.claude-trello/trello-session.sh status done
```

### 7. "목록"인 경우

```bash
~/.claude-trello/trello-session.sh list
```

## 핵심 규칙

1. **요약/제목은 절대 사용자에게 물어보지 말 것** - 대화 내용을 분석하여 자동 생성
2. **세션 ID가 다르면 다른 카드** - 매핑 파일이 있을 때만 자동 연결
3. **카드 생성 시 포함할 정보**:
   - 프로젝트명 (현재 디렉토리)
   - 작업 요약 (대화 분석)
   - 세션 ID
4. **제목은 간결하게** - `[프로젝트명] 핵심 작업 내용` 형식 유지

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
