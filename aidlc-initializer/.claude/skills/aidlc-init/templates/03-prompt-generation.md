# AI-DLC 셋팅 프롬프트 3: 폴더 생성 및 프롬프트 세트 생성

## 개요

이 프롬프트는 두 보고서(프로젝트 목적/목표, AI-DLC 적용방식)를 기반으로 프로젝트에 맞는 AI-DLC 프롬프트 세트와 디렉토리 구조를 생성합니다.

## 참조 백서

- 원본 AI-DLC 백서 (`.claude/docs/ai-dlc-whitepaper-ko.md`)
- 확장 AI-DLC 백서 (`.claude/docs/ai-dlc-extended-whitepaper.md`)

---

## 태그 패턴 (범용)

```
당신의 과제: 두 보고서를 기반으로 프로젝트에 최적화된 AI-DLC 프롬프트 세트와 디렉토리 구조를 생성합니다.

먼저 다음 백서를 읽고 AI-DLC 방법론을 이해합니다.

1. 원본 AI-DLC 백서 (`.claude/docs/ai-dlc-whitepaper-ko.md`)를 읽고 AI-DLC의 핵심 철학을 이해합니다. 특히 부록 A의 프롬프트 예시를 참고합니다.

2. 확장 AI-DLC 백서 (`.claude/docs/ai-dlc-extended-whitepaper.md`)를 읽고 프롬프트 구조와 생성 방식을 이해합니다.

백서 이해가 완료되면, 다음 파일들을 읽습니다.

- `docs/aidlc-docs_{주제}/project-goal-report.md`
- `docs/aidlc-docs_{주제}/application-approach-report.md`

보고서에서 선정된 설계 방법론, 아키텍처 패턴, AI-DLC 적용 계획, 프롬프트 패턴(태그 패턴 또는 Claude Code 패턴), 프로젝트 특성을 추출합니다.

디렉토리 구조를 생성합니다. plan.md, prompts/ 폴더, inception/, construction/, operations/ 폴더를 생성합니다.

선정된 방법론에 맞는 프롬프트 세트를 생성합니다. 각 프롬프트는 역할 정의, 계획 수립 지시, 승인 요청, 작업 정의를 포함하며, 선택된 패턴(태그 패턴 또는 Claude Code 패턴)에 맞게 작성합니다. prompts/README.md에 프롬프트 사용 가이드를 작성합니다.

생성이 완료되면 [Question]과 [Answer] 태그를 사용하여 최종 검토를 요청합니다. 생성된 구조와 다음 단계를 안내합니다.
```

---

## Claude Code 패턴 (Claude Code CLI 전용)

```
당신의 과제: 두 보고서를 기반으로 프로젝트에 최적화된 AI-DLC 프롬프트 세트와 디렉토리 구조를 생성합니다.

먼저 다음 백서를 읽고 AI-DLC 방법론을 이해합니다.

1. 원본 AI-DLC 백서 (`.claude/docs/ai-dlc-whitepaper-ko.md`)를 읽고 AI-DLC의 핵심 철학을 이해합니다. 특히 부록 A의 프롬프트 예시를 참고합니다.

2. 확장 AI-DLC 백서 (`.claude/docs/ai-dlc-extended-whitepaper.md`)를 읽고 프롬프트 구조와 생성 방식을 이해합니다.

백서 이해가 완료되면, 다음 파일들을 읽습니다.

- `docs/aidlc-docs_{주제}/project-goal-report.md`
- `docs/aidlc-docs_{주제}/application-approach-report.md`

보고서에서 선정된 설계 방법론, 아키텍처 패턴, AI-DLC 적용 계획, 프롬프트 패턴(태그 패턴 또는 Claude Code 패턴), 프로젝트 특성을 추출합니다.

디렉토리 구조를 생성합니다. plan.md, prompts/ 폴더, inception/, construction/, operations/ 폴더를 생성합니다.

선정된 방법론에 맞는 프롬프트 세트를 생성합니다. 각 프롬프트는 역할 정의, 계획 수립 지시, 승인 요청, 작업 정의를 포함하며, 선택된 패턴(태그 패턴 또는 Claude Code 패턴)에 맞게 작성합니다. prompts/README.md에 프롬프트 사용 가이드를 작성합니다.

생성이 완료되면 AskUserQuestion 툴을 사용하여 최종 검토를 요청합니다. 생성된 구조와 다음 단계를 안내합니다.
```
