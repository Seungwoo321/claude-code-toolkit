# Commit Tool

Git 커밋 메시지 자동 생성 도구

## 진화 과정

```
v1-basic (쉘 스크립트)
    ↓ diff 크기 제한 문제 발생
v2-tree-compression (쉘 스크립트)
    ↓ 프로젝트마다 복사/배포 번거로움
    ↓ Cursor CLI 지원 필요 (토큰 절약)
genai-commit (Node.js CLI) ← 현재 권장
```

## genai-commit (권장)

쉘 스크립트의 번거로움을 해결한 Node.js CLI 버전입니다.

```bash
# 설치 없이 바로 사용
npx genai-commit claude-code
npx genai-commit cursor-cli

# 글로벌 설치
npm install -g genai-commit
```

**주요 개선점**:
- `npx`로 어디서나 실행 (프로젝트별 복사 불필요)
- Claude Code + Cursor CLI 둘 다 지원
- Jira 티켓 연동 (`[t]` 옵션으로 동일 티켓 커밋 병합)
- npm 업데이트 한 번으로 모든 프로젝트에 적용

**링크**:
- GitHub: [github.com/Seungwoo321/genai-commit](https://github.com/Seungwoo321/genai-commit)
- npm: [npmjs.com/package/genai-commit](https://www.npmjs.com/package/genai-commit)

---

## 쉘 스크립트 버전 (아카이브)

genai-commit 이전의 쉘 스크립트 버전들입니다. 참고용으로 보존합니다.

### v1-basic

기본 버전. Claude Code CLI를 사용하여 diff 기반 커밋 메시지 생성.

```bash
./v1-basic/generate-commit-msg.sh
```

**특징**:
- diff 크기 제한: 50KB
- Untracked 파일 제한: 100개
- Claude Haiku 모델 사용

### v2-tree-compression

대규모 변경사항 처리를 위한 개선 버전. 파일 목록을 트리 형식으로 압축.

```bash
./v2-tree-compression/generate-commit-msg.sh
```

**개선점**:
- 전체 입력 크기 제한: 30KB
- 2단계 분석: 트리 요약 생성 → Modified 파일 diff 추출
- 디렉토리별 파일 그룹핑으로 정보 손실 없이 압축
- 타임아웃 설정 (120초)

### 공통 구조

```
vX/
├── generate-commit-msg.sh    # 메인 스크립트
└── agents/
    ├── commit-msg-prompt.txt # AI 프롬프트
    └── commit-msg-schema.json # JSON 스키마
```
