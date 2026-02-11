# Trello Skill for Claude Code

Claude Code 세션을 Trello 카드와 연동하는 스킬입니다.

## 설치

1. 스킬 폴더 복사:
```bash
cp -r trello ~/.claude/skills/
```

2. 스크립트 설치:
```bash
mkdir -p ~/.claude-trello
cp trello/scripts/* ~/.claude-trello/
chmod +x ~/.claude-trello/*.sh ~/.claude-trello/claude-session
```

3. 설정 파일 생성 (`~/.claude-trello/config.json`):
```json
{
  "api_key": "YOUR_TRELLO_API_KEY",
  "token": "YOUR_TRELLO_TOKEN",
  "board_id": "YOUR_BOARD_ID",
  "lists": {
    "urgent": "LIST_ID_FOR_URGENT",
    "in_progress": "LIST_ID_FOR_IN_PROGRESS",
    "paused": "LIST_ID_FOR_PAUSED",
    "done": "LIST_ID_FOR_DONE"
  }
}
```

## Trello API 키 발급

1. [Trello Power-Up Admin](https://trello.com/power-ups/admin)에서 API 키 발급
2. 토큰 생성: `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=YOUR_API_KEY`
3. 보드 ID: 보드 URL에서 확인 (`https://trello.com/b/BOARD_ID/...`)
4. 리스트 ID: Trello API로 조회 또는 브라우저 개발자 도구에서 확인

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `/trello` | 현재 세션 카드 연결 (없으면 생성) |
| `/trello 생성` | 새 카드 생성 (대화 분석 후 자동 요약) |
| `/trello 연결` | 기존 카드와 연결 |
| `/trello 기록` | 작업 내용을 코멘트로 추가 |
| `/trello 제목` | 카드 제목 변경 |
| `/trello 일시정지` | 상태를 paused로 변경 |
| `/trello 완료` | 상태를 done으로 변경 |
| `/trello 목록` | 전체 카드 목록 |

## 요구사항

- bash, curl, jq
- Trello 계정 및 API 키

## 라이선스

MIT
