# AI DLC Initializer

AI-DLC 방법론 셋팅 자동화 도구

## 개요

이 도구는 AI-DLC (AI-Driven Development Lifecycle) 방법론을 프로젝트에 적용하기 위한 초기 셋팅을 자동화합니다.

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

## 프롬프트 패턴

| 패턴 | 방식 | 환경 |
|------|------|------|
| 태그 패턴 | `[Question]`, `[Answer]` 태그 | 범용 (모든 AI 도구) |
| Claude Code 패턴 | `AskUserQuestion` 툴 사용 | Claude Code CLI |

## 프로젝트 상태 지원

- **신규 프로젝트**: 빈 폴더에서 시작
- **리팩토링**: 기존 구현된 프로젝트 개선
- **기능 추가**: 기존 프로젝트에 새 기능 개발

## 설치 및 사용

```bash
cp -r aidlc-initializer/.claude/skills/aidlc-init ~/.claude/skills/
```

Claude Code에서 `/aidlc-init` 실행

## 산출물 구조

```
docs/aidlc-docs_{주제}/
├── project-goal-report.md              # 보고서 1: 프로젝트 목적/목표
├── application-approach-report.md      # 보고서 2: AI-DLC 적용방식
├── plan.md                              # 작업 계획 (체크박스)
├── prompts/                             # AI-DLC 프롬프트
│   ├── README.md                        # 프롬프트 사용 가이드
│   └── *.md                             # 프로젝트 특성에 맞게 생성
├── inception/                           # Inception 단계 산출물
├── construction/                        # Construction 단계 산출물
└── operations/                          # Operations 단계 산출물
```

## 참조

### 핵심 백서 (설치 시 함께 복사됨)

**1. 원본 AI-DLC 백서** (철학/원칙)
- 경로: `.claude/skills/aidlc-init/docs/ai-dlc-whitepaper-ko.md`
- 내용: Raja SP(AWS)의 AI-DLC 방법론 정의
- 핵심: 대화 방향의 역전, 볼트 사이클, 10가지 원칙

**2. 확장 AI-DLC 백서** (프로젝트 분석 기반 적용)
- 경로: `.claude/skills/aidlc-init/docs/ai-dlc-extended-whitepaper.md`
- 내용: 프로젝트 분석 후 적합한 설계 방법론 선택
- 핵심: AI-DLC는 철학, 모든 검증된 방법론 사용 가능

### AI-DLC 핵심 원칙

1. **대화 방향의 역전**: AI가 대화를 주도하고, 인간은 승인자로 기능
2. **볼트(Bolt) 사이클**: 시간/일 단위 빠른 반복 (주 단위 스프린트 대체)
3. **계획-승인-실행 패턴**: AI가 계획 → 인간 승인 → 단계별 실행

### AI-DLC 단계

1. **Inception (기획)**: 의도 → 요구사항 정의 → 유닛 분해
2. **Construction (구축)**: 설계 → API 설계 → 구현 계획 → 코드 생성
3. **Operations (운영)**: 테스트 계획 → 배포 계획 → 모니터링

## 파일 구조

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
│               ├── 01-project-goal.md             # 셋팅 1: 정보 수집 + 목적/목표 보고서
│               ├── 02-application-approach.md     # 셋팅 2: 적용방식 보고서
│               └── 03-prompt-generation.md        # 셋팅 3: 폴더/프롬프트 생성
└── README.md
```
