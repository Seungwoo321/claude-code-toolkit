---
name: aidlc-init
description: AI-DLC 방법론 초기 셋팅 자동화 도구. /aidlc-init 명령으로 실행하며, 프로젝트 정보 수집 → 목적/목표 보고서 생성 → 적용방식 보고서 생성 → 프롬프트 생성 순으로 진행합니다.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# AI-DLC Initializer

AI-DLC 방법론 초기 셋팅 자동화 도구

<role>
이 스킬은 AI-DLC 방법론을 프로젝트에 적용하기 위한 초기 셋팅을 수행합니다.

핵심 원칙:
- 3단계의 셋팅 프롬프트를 순차적으로 실행합니다
- 각 단계에서 사용자의 검토와 피드백을 받습니다
- 참조 백서를 먼저 읽고 이해한 후 실행합니다
</role>

<input_contract>
실행 조건:
- 사용자가 `/aidlc-init` 명령을 실행했을 때

필수 수집 정보:
- 작업 주제 (폴더명에 사용: `docs/aidlc-docs_{주제}/`)
- 프로젝트 상태 (신규 프로젝트 / 리팩토링 / 기능 추가)
- 프로젝트 설명 (목적, 핵심 기능, 타겟 사용자, 기술 스택, 특별 요구사항)
- 프롬프트 패턴 선택 (태그 패턴 / Claude Code 패턴)
</input_contract>

<output_contract>
최종 산출물:
```
docs/aidlc-docs_{주제}/
├── project-goal-report.md              # 보고서 1
├── application-approach-report.md      # 보고서 2
├── plan.md                              # 작업 계획 (체크박스)
├── prompts/                             # AI-DLC 프롬프트
│   ├── README.md                        # 프롬프트 사용 가이드
│   └── *.md                             # 프로젝트 특성에 맞게 생성
├── inception/
├── construction/
└── operations/
```

완료 메시지:
```
AI-DLC 초기화가 완료되었습니다.

생성된 구조:
- docs/aidlc-docs_{주제}/

다음 단계:
1. prompts/README.md에서 프롬프트 사용 가이드 확인
2. 첫 번째 프롬프트부터 순차 실행
3. plan.md의 체크박스를 따라 진행
```
</output_contract>

<reference_docs>
실행 전 반드시 다음 백서들을 읽고 이해해야 합니다:

1. **원본 AI-DLC 백서** - `.claude/skills/aidlc-init/docs/ai-dlc-whitepaper-ko.md`
   - Raja SP(AWS)의 AI-DLC 방법론 정의
   - 핵심 철학: 대화 방향의 역전, 볼트 사이클, 계획-승인-실행 패턴

2. **확장 AI-DLC 백서** - `.claude/skills/aidlc-init/docs/ai-dlc-extended-whitepaper.md`
   - 프로젝트 분석 기반 적용 방식
   - 다양한 설계 방법론 지원
</reference_docs>

<execution>
## 실행 플로우

```
1. 스킬 실행 (/aidlc-init)
   ↓
2. 정보 수집 (AI 질문 → 사용자 답변)
   - 작업 주제
   - 프로젝트 상태 (신규/리팩토링/기능추가)
   - 프로젝트 설명
   - 프롬프트 패턴 선택 (태그 패턴 / Claude Code 패턴)
   ↓
3. [보고서 1] 프로젝트 목적/목표 보고서 생성
   → 사용자 검토 & 피드백
   ↓
4. [보고서 2] AI-DLC 적용방식 보고서 생성
   → 사용자 검토 & 피드백
   ↓
5. 폴더 생성 + AI-DLC 프롬프트 생성
   ↓
6. 준비 완료
```

## 1단계: 정보 수집

**.claude/skills/aidlc-init/templates/01-project-goal.md** 프롬프트의 1단계를 실행합니다.

수집 항목:
- 작업 주제 (폴더명에 사용: `docs/aidlc-docs_{주제}/`)
- 프로젝트 상태
  - 신규 프로젝트: 빈 폴더에서 시작
  - 리팩토링: 기존 프로젝트 개선
  - 기능 추가: 기존 프로젝트에 새 기능 개발
- 프로젝트 설명: 목적, 핵심 기능, 타겟 사용자, 기술 스택, 특별 요구사항
- 프롬프트 패턴 선택:
  - 태그 패턴: `[Question]`/`[Answer]` - 범용 AI 도구에서 사용 가능
  - Claude Code 패턴: `AskUserQuestion` - Claude Code CLI 전용

## 2단계: 프로젝트 목적/목표 보고서 생성

**.claude/skills/aidlc-init/templates/01-project-goal.md** 프롬프트의 2단계를 실행합니다.

수집된 정보를 바탕으로 프로젝트의 목적과 목표를 정리한 보고서를 생성합니다.

**산출물:** `docs/aidlc-docs_{주제}/project-goal-report.md`

보고서 구조:
- 산문형 서술로 프로젝트 배경, 목적, 목표 설명
- 표/다이어그램으로 핵심 정보 정리
- 기대 효과 및 성공 기준

사용자 검토 후 승인 또는 피드백을 받습니다.

## 3단계: AI-DLC 적용방식 보고서 생성

**.claude/skills/aidlc-init/templates/02-application-approach.md** 프롬프트를 실행합니다.

프로젝트 특성을 분석하고, 적합한 설계 방법론과 아키텍처 패턴을 선정합니다.

**산출물:** `docs/aidlc-docs_{주제}/application-approach-report.md`

보고서 구조:
- 프로젝트 분석 결과
- 설계 방법론 비교 및 선정 (전문적 근거 포함)
- 아키텍처 패턴 비교 및 선정 (전문적 근거 포함)
- AI-DLC 적용 계획

**중요:** 코드 예시 없이 보고서로서의 역할만 수행합니다.

사용자 검토 후 승인 또는 피드백을 받습니다.

## 4단계: 폴더 생성 및 프롬프트 생성

**.claude/skills/aidlc-init/templates/03-prompt-generation.md** 프롬프트를 실행합니다.

프롬프트는 선택된 패턴(태그 패턴 또는 Claude Code 패턴)에 맞게 생성됩니다.
</execution>

<prompt_patterns>
## 태그 패턴 (범용)

태그 패턴은 ChatGPT, Gemini, Claude 웹 등 모든 AI 도구에서 사용할 수 있는 범용 형식입니다. 프롬프트를 복사하여 다른 환경에서도 동일하게 실행할 수 있어 이식성이 높습니다.

이 패턴은 `[Question]`과 `[Answer]` 태그로 질문과 응답 영역을 명확히 구분합니다. AI가 질문을 제시하면 사용자가 `[Answer]` 태그 안에 응답을 작성하고, 이를 다시 AI에게 전달하는 방식으로 대화가 진행됩니다. 텍스트 기반의 단순한 구조이므로 어떤 AI 도구에서도 해석이 가능합니다.

단점은 매번 복사-붙여넣기가 필요하고, 선택형 질문의 경우 사용자가 직접 텍스트로 옵션을 선택해야 한다는 점입니다.

## Claude Code 패턴 (Claude Code CLI 전용)

Claude Code 패턴은 Claude Code CLI 환경에서만 사용 가능한 전용 형식입니다. `AskUserQuestion` 툴을 활용하여 터미널에서 직접 사용자와 상호작용합니다.

이 패턴의 장점은 선택형 UI를 제공한다는 것입니다. 사용자는 텍스트를 직접 입력하는 대신 화살표 키로 옵션을 선택할 수 있어 입력 오류가 줄어들고 작업 속도가 빨라집니다. 또한 여러 질문을 한 번에 묶어서 제시할 수 있고, 다중 선택(multiSelect) 옵션도 지원합니다.

단점은 Claude Code CLI 환경에서만 동작하므로 다른 AI 도구로 이식할 수 없다는 점입니다. 프롬프트를 공유하거나 다른 환경에서 재사용해야 하는 경우에는 태그 패턴이 더 적합합니다.
</prompt_patterns>

<file_structure>
```
aidlc-initializer/
├── .claude/
│   └── skills/
│       └── aidlc-init/
│           ├── SKILL.md                       # 스킬 정의
│           ├── docs/
│           │   ├── ai-dlc-whitepaper-ko.md        # 원본 AI-DLC 백서
│           │   └── ai-dlc-extended-whitepaper.md  # 확장 AI-DLC 백서
│           └── templates/
│               ├── 01-project-goal.md             # 정보 수집 + 보고서 1 생성
│               ├── 02-application-approach.md     # 보고서 2 생성
│               └── 03-prompt-generation.md        # 폴더/프롬프트 생성
└── README.md
```
</file_structure>

<constraints>
DO:
- 참조 백서를 먼저 읽고 이해한 후 실행합니다
- 각 단계에서 사용자의 검토와 피드백을 받습니다
- 보고서 생성 후 반드시 사용자 승인을 받고 다음 단계로 진행합니다
- 기존 프로젝트(리팩토링/기능추가)인 경우 설정 파일, 디렉토리 구조 분석을 수행합니다

DO NOT:
- 사용자 승인 없이 다음 단계로 넘어가지 않습니다
- 적용방식 보고서에 코드 예시를 포함하지 않습니다
- 기존 `docs/aidlc-docs_{주제}/` 폴더가 있을 때 확인 없이 덮어쓰지 않습니다
</constraints>

<critical>
- 각 보고서는 반드시 사용자 검토와 승인을 거쳐야 다음 단계로 진행합니다
- 참조 백서의 AI-DLC 철학(대화 방향의 역전, 볼트 사이클, 계획-승인-실행 패턴)을 준수합니다
- 프롬프트 패턴 선택에 따라 올바른 형식으로 프롬프트를 생성합니다
</critical>
