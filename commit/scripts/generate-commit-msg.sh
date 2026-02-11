#!/bin/bash
# generate-commit-msg.sh
# 오케스트레이션: git diff 수집 → Claude 에이전트 호출 → 사용자 입력 처리 → 커밋 실행
# v2: Tree 형식 압축 + 2단계 분석으로 정보 손실 없이 대규모 변경 처리

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/agents/commit-msg-prompt.txt"
SCHEMA_FILE="$SCRIPT_DIR/agents/commit-msg-schema.json"

# 기본 언어 설정
TITLE_LANG="en"
MESSAGE_LANG="ko"

# 제한 설정
MAX_INPUT_SIZE=30000      # 전체 입력 크기 제한 (30KB)
MAX_DIFF_SIZE=15000       # diff 크기 제한 (15KB)
AGENT_TIMEOUT=120         # Claude 호출 타임아웃 (초)
TREE_DEPTH=3              # 트리 표시 깊이

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --title-lang)
            TITLE_LANG="$2"
            shift 2
            ;;
        --message-lang)
            MESSAGE_LANG="$2"
            shift 2
            ;;
        --lang)
            TITLE_LANG="$2"
            MESSAGE_LANG="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --title-lang <en|ko>    Language for commit title (default: en)"
            echo "  --message-lang <en|ko>  Language for commit message (default: ko)"
            echo "  --lang <en|ko>          Set both title and message language"
            echo "  -h, --help              Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Git 저장소 확인
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository${NC}" >&2
    exit 1
fi

# Git 정보 수집
BRANCH=$(git branch --show-current)

# 파일 목록을 트리 형식으로 압축 (정보 손실 없음)
# 입력: 파일 목록 (줄바꿈 구분)
# 출력: 트리 형식 요약
generate_tree_summary() {
    local files="$1"
    local change_type="$2"  # A, M, D, ?
    local prefix="$3"       # 출력 prefix (예: "  ")

    if [ -z "$files" ]; then
        return
    fi

    local file_count=$(echo "$files" | wc -l | tr -d ' ')

    # 파일이 10개 이하면 그냥 나열
    if [ "$file_count" -le 10 ]; then
        echo "$files" | while read -r file; do
            echo "${prefix}${change_type} ${file}"
        done
        return
    fi

    # 최상위 디렉토리별로 그룹핑
    echo "$files" | awk -v prefix="$prefix" -v ctype="$change_type" -v depth="$TREE_DEPTH" '
    BEGIN {
        # 파일 확장자 카운트용
    }
    {
        file = $0
        n = split(file, parts, "/")

        # 최상위 디렉토리 (depth 단계까지)
        if (n <= depth) {
            # 얕은 경로는 개별 표시
            individual[file] = 1
        } else {
            # 깊은 경로는 그룹핑
            dir = parts[1]
            for (i = 2; i <= depth; i++) {
                dir = dir "/" parts[i]
            }
            dir_count[dir]++

            # 확장자 수집
            if (match(file, /\.[^.\/]+$/)) {
                ext = substr(file, RSTART+1, RLENGTH-1)
                dir_ext[dir][ext]++
                ext_count[dir, ext]++
            }
        }
    }
    END {
        # 개별 파일 먼저 출력
        for (file in individual) {
            print prefix ctype " " file
        }

        # 디렉토리별 요약 출력 (파일 수 내림차순)
        n = asorti(dir_count, sorted_dirs)

        # 파일 수로 정렬하기 위해 배열 재구성
        for (i = 1; i <= n; i++) {
            dir = sorted_dirs[i]
            count = dir_count[dir]
            # 정렬을 위해 count를 키로
            sort_key = sprintf("%08d", 99999999 - count) SUBSEP dir
            sorted_by_count[sort_key] = dir
        }

        n = asorti(sorted_by_count, final_sorted)
        for (i = 1; i <= n; i++) {
            dir = sorted_by_count[final_sorted[i]]
            count = dir_count[dir]

            # 해당 디렉토리의 확장자 요약
            ext_summary = ""
            for (key in ext_count) {
                split(key, kparts, SUBSEP)
                if (kparts[1] == dir) {
                    if (ext_summary != "") ext_summary = ext_summary ", "
                    ext_summary = ext_summary ext_count[key] " *." kparts[2]
                }
            }

            if (ext_summary != "") {
                printf "%s%s %s/ [%d files: %s]\n", prefix, ctype, dir, count, ext_summary
            } else {
                printf "%s%s %s/ [%d files]\n", prefix, ctype, dir, count
            }
        }
    }
    '
}

# 전체 변경사항을 트리 형식으로 요약 생성
generate_full_tree_summary() {
    local stats=$(git diff --shortstat HEAD 2>/dev/null || echo "")

    # 변경 유형별 파일 분류
    local added_files=$(git diff --name-only --diff-filter=A HEAD 2>/dev/null || echo "")
    local modified_files=$(git diff --name-only --diff-filter=M HEAD 2>/dev/null || echo "")
    local deleted_files=$(git diff --name-only --diff-filter=D HEAD 2>/dev/null || echo "")
    local renamed_files=$(git diff --name-only --diff-filter=R HEAD 2>/dev/null || echo "")

    # Untracked 파일
    local untracked_files=$(git ls-files --others --exclude-standard 2>/dev/null || echo "")

    # 각 유형별 개수
    local added_count=0 modified_count=0 deleted_count=0 renamed_count=0 untracked_count=0
    [ -n "$added_files" ] && added_count=$(echo "$added_files" | wc -l | tr -d ' ')
    [ -n "$modified_files" ] && modified_count=$(echo "$modified_files" | wc -l | tr -d ' ')
    [ -n "$deleted_files" ] && deleted_count=$(echo "$deleted_files" | wc -l | tr -d ' ')
    [ -n "$renamed_files" ] && renamed_count=$(echo "$renamed_files" | wc -l | tr -d ' ')
    [ -n "$untracked_files" ] && untracked_count=$(echo "$untracked_files" | wc -l | tr -d ' ')

    local total_files=$((added_count + modified_count + deleted_count + renamed_count + untracked_count))

    # 헤더
    echo "=== CHANGE SUMMARY ==="
    echo "Branch: $BRANCH"
    echo "Statistics: $stats"
    echo "Total: $total_files files"
    echo "  - Added (A): $added_count"
    echo "  - Modified (M): $modified_count"
    echo "  - Deleted (D): $deleted_count"
    echo "  - Renamed (R): $renamed_count"
    echo "  - Untracked (?): $untracked_count"
    echo ""

    # 각 유형별 트리 요약
    echo "=== FILE TREE (all files, compressed) ==="
    echo ""

    if [ -n "$modified_files" ]; then
        echo "--- Modified ($modified_count) ---"
        generate_tree_summary "$modified_files" "M" ""
        echo ""
    fi

    if [ -n "$added_files" ]; then
        echo "--- Added ($added_count) ---"
        generate_tree_summary "$added_files" "A" ""
        echo ""
    fi

    if [ -n "$deleted_files" ]; then
        echo "--- Deleted ($deleted_count) ---"
        generate_tree_summary "$deleted_files" "D" ""
        echo ""
    fi

    if [ -n "$renamed_files" ]; then
        echo "--- Renamed ($renamed_count) ---"
        generate_tree_summary "$renamed_files" "R" ""
        echo ""
    fi

    if [ -n "$untracked_files" ]; then
        echo "--- Untracked ($untracked_count) ---"
        generate_tree_summary "$untracked_files" "?" ""
        echo ""
    fi
}

# Modified 파일의 실제 diff 추출 (중요한 컨텍스트용)
get_modified_diffs() {
    local max_size=$1
    local current_size=0
    local output=""

    # Modified 파일만 대상
    local modified_files=$(git diff --name-only --diff-filter=M HEAD 2>/dev/null)

    if [ -z "$modified_files" ]; then
        return
    fi

    local file_count=$(echo "$modified_files" | wc -l | tr -d ' ')

    output="
=== MODIFIED FILE DIFFS ($file_count files) ==="

    while IFS= read -r file; do
        [ -z "$file" ] && continue

        local file_diff=$(git diff HEAD -- "$file" 2>/dev/null)
        local diff_size=${#file_diff}

        # 크기 제한 체크
        if [ $((current_size + diff_size + 100)) -gt "$max_size" ]; then
            local remaining=$((file_count - $(echo "$output" | grep -c "^--- ")))
            output+="

[... $remaining more files truncated due to size limit]"
            break
        fi

        if [ -n "$file_diff" ]; then
            output+="

--- $file ---
$file_diff"
            current_size=$((current_size + diff_size))
        fi
    done <<< "$modified_files"

    echo "$output"
}

# 변경사항 확인
CHANGES_EXIST=false
if [ -n "$(git diff --name-only HEAD 2>/dev/null)" ] || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
    CHANGES_EXIST=true
fi

if [ "$CHANGES_EXIST" = false ]; then
    echo -e "${YELLOW}No changes to commit${NC}"
    exit 0
fi

# 분석 시작
echo -e "${GREEN}Analyzing changes on branch: ${CYAN}$BRANCH${NC}"

# 1단계: 전체 트리 요약 생성
echo -e "${CYAN}[1/2] Generating file tree summary...${NC}"
TREE_SUMMARY=$(generate_full_tree_summary)
TREE_SIZE=${#TREE_SUMMARY}
echo -e "  Tree summary: ${TREE_SIZE} bytes"

# 2단계: Modified 파일의 diff 추출
echo -e "${CYAN}[2/2] Extracting modified file diffs...${NC}"
REMAINING_SIZE=$((MAX_INPUT_SIZE - TREE_SIZE - 500))  # 여유 500 bytes

if [ "$REMAINING_SIZE" -gt 1000 ]; then
    if [ "$REMAINING_SIZE" -gt "$MAX_DIFF_SIZE" ]; then
        REMAINING_SIZE=$MAX_DIFF_SIZE
    fi
    DIFF_CONTENT=$(get_modified_diffs $REMAINING_SIZE)
    DIFF_SIZE=${#DIFF_CONTENT}
    echo -e "  Diff content: ${DIFF_SIZE} bytes"
else
    DIFF_CONTENT=""
    echo -e "  Diff content: skipped (tree too large)"
fi

# 최종 입력 조합
INPUT="TITLE_LANG: $TITLE_LANG
MESSAGE_LANG: $MESSAGE_LANG

$TREE_SUMMARY"

if [ -n "$DIFF_CONTENT" ]; then
    INPUT+="$DIFF_CONTENT"
fi

# 입력 크기 확인
INPUT_SIZE=${#INPUT}
echo -e "${GREEN}Total input size: ${INPUT_SIZE} bytes${NC}"

if [ "$INPUT_SIZE" -gt "$MAX_INPUT_SIZE" ]; then
    echo -e "${YELLOW}Warning: Input size exceeds limit. Truncating...${NC}"
    INPUT="${INPUT:0:$MAX_INPUT_SIZE}

[INPUT TRUNCATED - Original size: $INPUT_SIZE bytes]"
    INPUT_SIZE=${#INPUT}
fi

# 세션 ID 저장 변수
SESSION_ID=""

# Claude 에이전트 호출 함수
call_agent() {
    local input="$1"
    local resume_flag=""

    if [ -n "$SESSION_ID" ]; then
        resume_flag="--resume $SESSION_ID"
    fi

    # 임시 파일 사용 (큰 입력 처리)
    local tmp_input=$(mktemp)
    local tmp_schema=$(mktemp)
    local tmp_prompt=$(mktemp)

    echo "$input" > "$tmp_input"
    cat "$SCHEMA_FILE" > "$tmp_schema"
    cat "$PROMPT_FILE" > "$tmp_prompt"

    # Claude 호출 (타임아웃 적용)
    local response
    local exit_code=0

    if [ -n "$resume_flag" ]; then
        response=$(timeout $AGENT_TIMEOUT claude -p \
            --model haiku \
            --output-format json \
            --json-schema "$(cat "$tmp_schema")" \
            --append-system-prompt "$(cat "$tmp_prompt")" \
            $resume_flag < "$tmp_input" 2>&1) || exit_code=$?
    else
        response=$(timeout $AGENT_TIMEOUT claude -p \
            --model haiku \
            --output-format json \
            --json-schema "$(cat "$tmp_schema")" \
            --append-system-prompt "$(cat "$tmp_prompt")" < "$tmp_input" 2>&1) || exit_code=$?
    fi

    # 임시 파일 정리
    rm -f "$tmp_input" "$tmp_schema" "$tmp_prompt"

    if [ $exit_code -eq 124 ]; then
        echo -e "${RED}Error: Agent timeout after ${AGENT_TIMEOUT}s${NC}" >&2
        return 1
    elif [ $exit_code -ne 0 ]; then
        echo -e "${RED}Error: Agent call failed (exit code: $exit_code)${NC}" >&2
        echo "Response: $response" >&2
        return 1
    fi

    # 세션 ID 추출 (첫 호출 시)
    if [ -z "$SESSION_ID" ]; then
        SESSION_ID=$(echo "$response" | jq -r '.session_id // empty' 2>/dev/null)
    fi

    # structured_output 필드에서 결과 추출
    echo "$response" | jq -c '.structured_output // empty' 2>/dev/null
}

# JSON에서 커밋 메시지 추출하여 표시
display_commits() {
    local json="$1"

    echo -e "\n${GREEN}=== Proposed Commits ===${NC}\n"

    # JSON 배열 파싱하여 표시
    local count
    count=$(echo "$json" | jq '.commits | length' 2>/dev/null)

    for ((i=0; i<count; i++)); do
        local files title message
        files=$(echo "$json" | jq -r ".commits[$i].files | join(\", \")" 2>/dev/null)
        title=$(echo "$json" | jq -r ".commits[$i].title" 2>/dev/null)
        message=$(echo "$json" | jq -r ".commits[$i].message" 2>/dev/null)

        echo -e "${CYAN}[$((i+1))]${NC} ${GREEN}$title${NC}"
        echo -e "    Files: $files"
        echo -e "    Message: $message"
        echo ""
    done
}

# 커밋 실행
execute_commits() {
    local json="$1"

    local count
    count=$(echo "$json" | jq '.commits | length' 2>/dev/null)

    for ((i=0; i<count; i++)); do
        local files title message
        files=$(echo "$json" | jq -r ".commits[$i].files[]" 2>/dev/null)
        title=$(echo "$json" | jq -r ".commits[$i].title" 2>/dev/null)
        message=$(echo "$json" | jq -r ".commits[$i].message" 2>/dev/null)

        # 파일 스테이징
        echo -e "${YELLOW}Staging files for commit $((i+1))...${NC}"
        while IFS= read -r file; do
            if [ -n "$file" ]; then
                # 파일이 존재하면 add, 삭제된 파일이면 rm으로 스테이징
                if [ -e "$file" ]; then
                    git add "$file"
                else
                    git rm --cached "$file" 2>/dev/null || git add -A "$file" 2>/dev/null || true
                fi
            fi
        done <<< "$files"

        # 커밋 실행
        echo -e "${GREEN}Committing: $title${NC}"
        if ! git commit -m "$title" -m "$message"; then
            echo -e "${RED}Commit failed. Aborting.${NC}" >&2
            exit 1
        fi

        echo ""
    done

    echo -e "${GREEN}All commits completed successfully!${NC}"
}

# 에이전트 호출
echo -e "${CYAN}Calling Claude agent...${NC}"
COMMITS_JSON=$(call_agent "$INPUT")

# JSON 파싱 및 commits 배열 추출
if ! echo "$COMMITS_JSON" | jq -e '.commits' > /dev/null 2>&1; then
    echo -e "${RED}Failed to parse agent response${NC}" >&2
    echo "Raw response: $COMMITS_JSON"
    exit 1
fi

# 메인 루프
while true; do
    display_commits "$COMMITS_JSON"

    echo -e "${YELLOW}[y]${NC} Commit all  ${YELLOW}[n]${NC} Cancel  ${YELLOW}[f]${NC} Feedback"
    echo -n "> "

    # 단일 키 입력 (Enter 없이 바로 인식)
    read -r -n 1 user_input
    echo ""  # 줄바꿈

    case "$user_input" in
        y|Y)
            execute_commits "$COMMITS_JSON"
            break
            ;;
        n|N)
            echo -e "${YELLOW}Cancelled${NC}"
            exit 0
            ;;
        f|F)
            # 피드백 입력 받기
            echo -e "${CYAN}Enter your feedback (press Enter to submit):${NC}"
            read -r -p "feedback> " feedback_text

            if [ -z "$feedback_text" ]; then
                echo -e "${YELLOW}Empty feedback, skipping...${NC}"
                continue
            fi

            echo -e "${CYAN}Sending feedback to agent...${NC}"
            COMMITS_JSON=$(call_agent "$feedback_text")

            if ! echo "$COMMITS_JSON" | jq -e '.commits' > /dev/null 2>&1; then
                echo -e "${RED}Failed to parse agent response${NC}" >&2
                echo "Raw response: $COMMITS_JSON"
            fi
            ;;
        *)
            echo -e "${RED}Invalid option. Press y, n, or f${NC}"
            ;;
    esac
done
