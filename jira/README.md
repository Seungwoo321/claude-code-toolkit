# Jira Skill for Claude Code

Claude Code에서 Jira Cloud 티켓을 관리하는 스킬입니다.

## 설치

1. 스킬 폴더 복사:
```bash
cp -r jira ~/.claude/skills/
```

2. 스킬 설정:
```bash
/jira 설정
```

설정 명령어를 실행하면 다음 정보를 입력받아 자동으로 config.json을 생성합니다:
- Jira 사이트 URL (예: https://your-site.atlassian.net)
- 프로젝트 키 (예: PROJ)
- 이메일
- API 토큰 ([Atlassian API 토큰 생성](https://id.atlassian.com/manage-profile/security/api-tokens))

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `/jira` | 현재 브랜치의 티켓 조회 |
| `/jira 조회 AS-1234` | 특정 티켓 조회 |
| `/jira 목록` | 내 담당 티켓 목록 |
| `/jira 목록 --스프린트 current` | 현재 스프린트 이슈 |
| `/jira 목록 --백로그` | 백로그 이슈 |
| `/jira 스프린트` | 스프린트 목록 |
| `/jira 상태 진행중` | 현재 티켓 상태 변경 |
| `/jira 할당 홍길동` | 현재 티켓 담당자 변경 |
| `/jira 코멘트 "내용"` | 현재 티켓에 코멘트 추가 |
| `/jira 설정` | 환경 설정 |

## 브랜치 형식

스킬은 브랜치명에서 티켓 번호를 자동 추출합니다:

```
feature/AS-1234/short-description
bugfix/AS-5678
AS-9999
```

## 요구사항

- Node.js 18+
- npx tsx (TypeScript 실행)
- Jira Cloud 계정 및 API 토큰

## 라이선스

MIT
