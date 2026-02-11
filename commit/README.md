# Commit Tool

Git 커밋 메시지 자동 생성 도구

## 히스토리

이 쉘 스크립트가 커밋 메시지 자동화의 시작점이었습니다.

사용하면서 매번 프로젝트마다 스크립트를 복사하고 설정하는 번거로움이 있었고, 이를 개선하고자 별도 프로젝트로 발전시켰습니다. 현재는 **genai-commit**으로 npx를 통해 설치 없이 바로 사용할 수 있으며, Claude Code 외에 Cursor CLI도 지원합니다.

## genai-commit

```bash
# 설치 없이 바로 사용
npx genai-commit

# 글로벌 설치
npm install -g genai-commit
```

- GitHub: [github.com/Seungwoo321/genai-commit](https://github.com/Seungwoo321/genai-commit)
- npm: [npmjs.com/package/genai-commit](https://www.npmjs.com/package/genai-commit)

## 원본 스크립트

이 폴더의 스크립트는 초기 버전으로, 참고용으로 보존합니다.

```bash
./scripts/generate-commit-msg.sh
```
