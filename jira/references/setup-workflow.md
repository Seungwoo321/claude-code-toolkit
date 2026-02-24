# 설정 워크플로우

"설정" 명령 시 LLM이 현재 Jira 환경을 분석하고 config.json을 구성합니다.

## 환경 정보 조회

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

## 설정 초기화/업데이트

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

## 대화형 설정 워크플로우

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

## 필드 매핑

주요 커스텀 필드:

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
