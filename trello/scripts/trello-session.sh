#!/bin/bash
# Claude Code Session Manager for Trello v3.0
# 세션 ID 기반 자동 연동 지원

CONFIG_FILE="$HOME/.claude-trello/config.json"
SESSION_FILE="$HOME/.claude-trello/current_session.json"
PROJECT_SESSION_FILE=".trello-session"
SESSIONS_DIR="$HOME/.claude-trello/sessions"

# Create sessions directory if not exists
mkdir -p "$SESSIONS_DIR"

# Load config
API_KEY=$(jq -r '.api_key' "$CONFIG_FILE")
TOKEN=$(jq -r '.token' "$CONFIG_FILE")
BOARD_ID=$(jq -r '.board_id' "$CONFIG_FILE")
LIST_URGENT=$(jq -r '.lists.urgent' "$CONFIG_FILE")
LIST_IN_PROGRESS=$(jq -r '.lists.in_progress' "$CONFIG_FILE")
LIST_PAUSED=$(jq -r '.lists.paused' "$CONFIG_FILE")
LIST_DONE=$(jq -r '.lists.done' "$CONFIG_FILE")

BASE_URL="https://api.trello.com/1"
AUTH="key=$API_KEY&token=$TOKEN"

# URL encode function
urlencode() {
    python3 -c "import urllib.parse; print(urllib.parse.quote('''$1''', safe=''))"
}

# Get current project name from directory
get_project_name() {
    basename "$(pwd)"
}

# Get current Claude Code session ID
get_claude_session_id() {
    local project_path="$(pwd)"
    local encoded_path=$(echo "$project_path" | sed 's|[/._ ]|-|g')
    local sessions_path="$HOME/.claude/projects/$encoded_path"

    if [[ -d "$sessions_path" ]]; then
        # Get most recently modified .jsonl file
        local latest_session=$(ls -t "$sessions_path"/*.jsonl 2>/dev/null | head -1)
        if [[ -n "$latest_session" ]]; then
            basename "$latest_session" .jsonl
        fi
    fi
}

# Find card by Claude session ID (local mapping only)
find_card_by_session_id() {
    local session_id="$1"
    local mapping_file="$SESSIONS_DIR/$session_id.json"

    # Only use local mapping file - no Trello search fallback
    if [[ -f "$mapping_file" ]]; then
        jq -r '.card_id' "$mapping_file"
        return 0
    fi

    return 1
}

# Save session ID to card mapping
save_session_mapping() {
    local session_id="$1"
    local card_id="$2"
    local card_url="$3"

    echo "{
  \"session_id\": \"$session_id\",
  \"card_id\": \"$card_id\",
  \"card_url\": \"$card_url\",
  \"mapped_at\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"
}" > "$SESSIONS_DIR/$session_id.json"
}

# Find .trello-session file (current dir or parent dirs)
find_session_file() {
    local dir="$(pwd)"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/$PROJECT_SESSION_FILE" ]]; then
            echo "$dir/$PROJECT_SESSION_FILE"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

# Get card ID from current project
get_current_card_id() {
    local session_file=$(find_session_file)
    if [[ -n "$session_file" ]]; then
        jq -r '.card_id' "$session_file"
        return 0
    fi
    return 1
}

# Auto-connect based on session ID
auto_connect() {
    local claude_session_id=$(get_claude_session_id)

    if [[ -z "$claude_session_id" ]]; then
        echo "⚠️  Claude Code 세션 ID를 찾을 수 없습니다."
        return 1
    fi

    echo "🔍 Claude 세션 ID: $claude_session_id"

    # Try to find existing card for this session
    local card_id=$(find_card_by_session_id "$claude_session_id")

    if [[ -n "$card_id" ]] && [[ "$card_id" != "null" ]]; then
        # Found existing card
        response=$(curl -s "$BASE_URL/cards/$card_id?$AUTH")
        card_name=$(echo "$response" | jq -r '.name')
        card_url=$(echo "$response" | jq -r '.shortUrl')
        list_id=$(echo "$response" | jq -r '.idList')

        case "$list_id" in
            "$LIST_URGENT") status="🔴 긴급" ;;
            "$LIST_IN_PROGRESS") status="🟡 진행중" ;;
            "$LIST_PAUSED") status="🟢 일시정지" ;;
            "$LIST_DONE") status="✅ 완료" ;;
            *) status="❓ 알 수 없음" ;;
        esac

        # Save to current session
        echo "{\"card_id\": \"$card_id\", \"session_id\": \"$claude_session_id\", \"card_url\": \"$card_url\"}" > "$SESSION_FILE"

        # 자동으로 진행중 상태로 변경 (완료/일시정지 상태였을 경우)
        if [[ "$list_id" != "$LIST_IN_PROGRESS" ]] && [[ "$list_id" != "$LIST_URGENT" ]]; then
            curl -s -X PUT "$BASE_URL/cards/$card_id?idList=$LIST_IN_PROGRESS&$AUTH" > /dev/null
            status="🟡 진행중 (자동 변경됨)"
        fi

        echo ""
        echo "🔗 기존 Trello 세션 자동 연결됨!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📌 카드: $card_name"
        echo "📊 상태: $status"
        echo "🔗 $card_url"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 0
    else
        echo "ℹ️  이 세션에 연결된 Trello 카드가 없습니다."
        return 1
    fi
}

# Initialize new session for current project
init_session() {
    local summary="$1"
    local priority="${2:-in_progress}"
    local force="${3:-}"
    local project_name=$(get_project_name)

    # 입력에서 프로젝트명 prefix 제거 (중복 방지)
    summary=$(echo "$summary" | sed "s/^\[${project_name}\] *//")
    local project_path="$(pwd)"
    local claude_session_id=$(get_claude_session_id)

    # 기존 카드 확인 (--force가 아닌 경우)
    if [[ "$force" != "--force" ]]; then
        local existing_card_id=$(find_card_by_session_id "$claude_session_id")
        if [[ -n "$existing_card_id" ]] && [[ "$existing_card_id" != "null" ]]; then
            # 기존 카드 정보 조회
            local existing_card=$(curl -s "$BASE_URL/cards/$existing_card_id?$AUTH")
            local existing_name=$(echo "$existing_card" | jq -r '.name')
            local existing_url=$(echo "$existing_card" | jq -r '.shortUrl')

            echo "⚠️  이 세션에 이미 연결된 카드가 있습니다:"
            echo "   📌 $existing_name"
            echo "   🔗 $existing_url"
            echo ""
            echo "선택하세요:"
            echo "  1) 기존 카드에 연결 (권장)"
            echo "  2) 기존 카드 삭제 후 새로 생성"
            echo "  3) 취소"
            echo ""
            read -r -p "선택 (1/2/3): " choice

            case "$choice" in
                1)
                    # 기존 카드에 연결
                    echo "{\"card_id\": \"$existing_card_id\", \"session_id\": \"$claude_session_id\", \"card_url\": \"$existing_url\"}" > "$SESSION_FILE"
                    echo "✅ 기존 카드에 연결되었습니다."
                    echo "🔗 $existing_url"
                    return 0
                    ;;
                2)
                    # 기존 카드 삭제
                    echo "🗑️  기존 카드 삭제 중..."
                    curl -s -X DELETE "$BASE_URL/cards/$existing_card_id?$AUTH" > /dev/null
                    rm -f "$SESSIONS_DIR/$claude_session_id.json"
                    echo "✅ 기존 카드가 삭제되었습니다."
                    # 계속 진행하여 새 카드 생성
                    ;;
                *)
                    echo "취소되었습니다."
                    return 1
                    ;;
            esac
        fi
    fi

    # Select list based on priority
    case "$priority" in
        urgent) LIST_ID="$LIST_URGENT" ;;
        paused) LIST_ID="$LIST_PAUSED" ;;
        done) LIST_ID="$LIST_DONE" ;;
        *) LIST_ID="$LIST_IN_PROGRESS" ;;
    esac

    local card_name="[$project_name] $summary"
    local card_desc="## 세션 정보
- **프로젝트**: $project_name
- **경로**: \`$project_path\`
- **Claude 세션 ID**: \`$claude_session_id\`
- **시작 시간**: $(date '+%Y-%m-%d %H:%M')

## 작업 내용
$summary

---
*Claude Code Session Manager*"

    local encoded_name=$(urlencode "$card_name")
    local encoded_desc=$(urlencode "$card_desc")

    response=$(curl -s -X POST "$BASE_URL/cards?idList=$LIST_ID&name=$encoded_name&desc=$encoded_desc&$AUTH")
    card_id=$(echo "$response" | jq -r '.id')
    card_url=$(echo "$response" | jq -r '.shortUrl')

    if [[ "$card_id" == "null" ]] || [[ -z "$card_id" ]]; then
        echo "❌ 카드 생성 실패"
        echo "$response"
        return 1
    fi

    # Save session ID mapping
    if [[ -n "$claude_session_id" ]]; then
        save_session_mapping "$claude_session_id" "$card_id" "$card_url"
    fi

    # Save to project directory
    echo "{
  \"card_id\": \"$card_id\",
  \"card_url\": \"$card_url\",
  \"project\": \"$project_name\",
  \"project_path\": \"$project_path\",
  \"claude_session_id\": \"$claude_session_id\",
  \"created_at\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"
}" > "$PROJECT_SESSION_FILE"

    # Also save as current session
    cp "$PROJECT_SESSION_FILE" "$SESSION_FILE"

    echo "✅ 세션 카드 생성 및 연결 완료"
    echo "📁 프로젝트: $project_name"
    echo "🔑 세션 ID: $claude_session_id"
    echo "🔗 $card_url"
    echo ""
    echo "💡 --resume으로 이 세션을 재개하면 자동으로 연동됩니다."
}

# Link existing card to current session
link_session() {
    local card_id="$1"
    local project_name=$(get_project_name)
    local project_path="$(pwd)"
    local claude_session_id=$(get_claude_session_id)

    if [[ -z "$card_id" ]]; then
        echo "❌ 카드 ID를 입력하세요."
        echo "   사용법: ts link <카드ID>"
        return 1
    fi

    # Verify card exists
    response=$(curl -s "$BASE_URL/cards/$card_id?$AUTH")
    card_url=$(echo "$response" | jq -r '.shortUrl')
    card_name=$(echo "$response" | jq -r '.name')

    if [[ "$card_url" == "null" ]]; then
        echo "❌ 카드를 찾을 수 없습니다: $card_id"
        return 1
    fi

    # Save session ID mapping
    if [[ -n "$claude_session_id" ]]; then
        save_session_mapping "$claude_session_id" "$card_id" "$card_url"

        # Update card description with session ID
        local current_desc=$(echo "$response" | jq -r '.desc')
        if [[ ! "$current_desc" =~ "$claude_session_id" ]]; then
            local updated_desc="$current_desc

---
**Claude 세션 ID**: \`$claude_session_id\`
**연결된 경로**: \`$project_path\`"
            local encoded_desc=$(urlencode "$updated_desc")
            curl -s -X PUT "$BASE_URL/cards/$card_id?desc=$encoded_desc&$AUTH" > /dev/null
        fi
    fi

    # Save to project directory
    echo "{
  \"card_id\": \"$card_id\",
  \"card_url\": \"$card_url\",
  \"project\": \"$project_name\",
  \"project_path\": \"$project_path\",
  \"claude_session_id\": \"$claude_session_id\",
  \"linked_at\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"
}" > "$PROJECT_SESSION_FILE"

    # Also save as current session
    cp "$PROJECT_SESSION_FILE" "$SESSION_FILE"

    echo "✅ 카드와 세션 연결 완료"
    echo "📁 프로젝트: $project_name"
    echo "📌 카드: $card_name"
    echo "🔑 세션 ID: $claude_session_id"
    echo "🔗 $card_url"
}

# Unlink current project from card
unlink_session() {
    if [[ -f "$PROJECT_SESSION_FILE" ]]; then
        rm "$PROJECT_SESSION_FILE"
        echo "✅ 프로젝트-카드 연결이 해제되었습니다."
    else
        echo "ℹ️  연결된 카드가 없습니다."
    fi
}

# Connect to existing session (session ID based only)
connect_session() {
    # Only try auto-connect by session ID
    if auto_connect; then
        return 0
    fi

    # No fallback - new session should create new card
    return 1
}

# Show current session info
info_session() {
    local claude_session_id=$(get_claude_session_id)
    echo "🔑 현재 Claude 세션 ID: $claude_session_id"
    echo ""

    local session_file=$(find_session_file)

    if [[ -z "$session_file" ]]; then
        echo "❌ 연결된 Trello 카드가 없습니다."
        return 1
    fi

    local card_id=$(jq -r '.card_id' "$session_file")

    # Get full card details
    response=$(curl -s "$BASE_URL/cards/$card_id?$AUTH")

    echo "$response" | jq -r '"
📌 \(.name)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

\(.desc)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 \(.shortUrl)
"'
}

# Update session card
update_session() {
    local card_id="$1"
    local field="$2"
    local value="$3"

    case "$field" in
        status)
            case "$value" in
                urgent) LIST_ID="$LIST_URGENT" ;;
                in_progress) LIST_ID="$LIST_IN_PROGRESS" ;;
                paused) LIST_ID="$LIST_PAUSED" ;;
                done) LIST_ID="$LIST_DONE" ;;
            esac
            curl -s -X PUT "$BASE_URL/cards/$card_id?idList=$LIST_ID&$AUTH" > /dev/null
            echo "✅ 상태 변경: $value"
            ;;
        comment)
            local encoded_value=$(urlencode "$value")
            curl -s -X POST "$BASE_URL/cards/$card_id/actions/comments?text=$encoded_value&$AUTH" > /dev/null
            echo "✅ 코멘트 추가됨"
            ;;
        desc)
            local encoded_value=$(urlencode "$value")
            curl -s -X PUT "$BASE_URL/cards/$card_id?desc=$encoded_value&$AUTH" > /dev/null
            echo "✅ 설명 업데이트됨"
            ;;
    esac
}

# Add comment to current session
add_comment() {
    local card_id=$(get_current_card_id)

    if [[ -z "$card_id" ]] || [[ "$card_id" == "null" ]]; then
        if [[ -f "$SESSION_FILE" ]]; then
            card_id=$(jq -r '.card_id' "$SESSION_FILE")
        fi
    fi

    if [[ -z "$card_id" ]] || [[ "$card_id" == "null" ]]; then
        echo "❌ 연결된 세션이 없습니다. 먼저 'ts init' 또는 'ts link'를 실행하세요."
        return 1
    fi

    local comment="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M')
    update_session "$card_id" "comment" "[$timestamp] $comment"
}

# Change session status
change_status() {
    local card_id=$(get_current_card_id)

    if [[ -z "$card_id" ]] || [[ "$card_id" == "null" ]]; then
        if [[ -f "$SESSION_FILE" ]]; then
            card_id=$(jq -r '.card_id' "$SESSION_FILE")
        fi
    fi

    if [[ -z "$card_id" ]] || [[ "$card_id" == "null" ]]; then
        echo "❌ 연결된 세션이 없습니다."
        return 1
    fi

    update_session "$card_id" "status" "$1"
}

# Change card title
change_title() {
    local new_title="$1"
    local card_id=$(get_current_card_id)

    if [[ -z "$card_id" ]] || [[ "$card_id" == "null" ]]; then
        if [[ -f "$SESSION_FILE" ]]; then
            card_id=$(jq -r '.card_id' "$SESSION_FILE")
        fi
    fi

    if [[ -z "$card_id" ]] || [[ "$card_id" == "null" ]]; then
        echo "❌ 연결된 세션이 없습니다."
        return 1
    fi

    if [[ -z "$new_title" ]]; then
        echo "❌ 제목을 입력하세요."
        echo "   사용법: ts title \"새 제목\""
        return 1
    fi

    local project_name=$(get_project_name)

    # 입력에서 프로젝트명 prefix 제거 (중복 방지)
    new_title=$(echo "$new_title" | sed "s/^\[${project_name}\] *//")

    local full_title="[$project_name] $new_title"
    local encoded_title=$(urlencode "$full_title")

    curl -s -X PUT "$BASE_URL/cards/$card_id?name=$encoded_title&$AUTH" > /dev/null
    echo "✅ 제목 변경: $full_title"
}

# List all session cards
list_sessions() {
    echo "📋 Claude Code Sessions"
    echo "========================"

    echo ""
    echo "🔴 긴급"
    echo "------------"
    curl -s "$BASE_URL/lists/$LIST_URGENT/cards?$AUTH" | jq -r '.[] | "  • \(.name)\n    ID: \(.id)\n    🔗 \(.shortUrl)"'

    echo ""
    echo "🟡 진행중"
    echo "------------"
    curl -s "$BASE_URL/lists/$LIST_IN_PROGRESS/cards?$AUTH" | jq -r '.[] | "  • \(.name)\n    ID: \(.id)\n    🔗 \(.shortUrl)"'

    echo ""
    echo "🟢 일시정지"
    echo "------------"
    curl -s "$BASE_URL/lists/$LIST_PAUSED/cards?$AUTH" | jq -r '.[] | "  • \(.name)\n    ID: \(.id)\n    🔗 \(.shortUrl)"'
}

# Get card details
get_session() {
    local card_id="$1"
    curl -s "$BASE_URL/cards/$card_id?$AUTH" | jq -r '"
📌 \(.name)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\(.desc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 \(.shortUrl)
"'
}

# Search cards by session ID
search_by_session() {
    local search_id="${1:-$(get_claude_session_id)}"
    echo "🔍 세션 ID로 카드 검색: $search_id"
    echo ""

    curl -s "$BASE_URL/boards/$BOARD_ID/cards?$AUTH" | jq -r --arg sid "$search_id" '
        .[] | select(.desc | contains($sid)) |
        "📌 \(.name)\n   ID: \(.id)\n   🔗 \(.shortUrl)\n"
    '
}

# Show help
show_help() {
    echo "Claude Code Session Manager for Trello v3.1"
    echo ""
    echo "🔑 세션 ID 기반 자동 연동:"
    echo "  ts auto                      세션 ID로 자동 카드 연결"
    echo "  ts connect                   자동 연결 (세션 ID → 프로젝트 파일 순)"
    echo ""
    echo "📁 프로젝트 기반 명령어:"
    echo "  ts init <요약> [우선순위]     새 카드 생성 (기존 카드 있으면 선택)"
    echo "  ts init <요약> [우선순위] --force  기존 카드 무시하고 새로 생성"
    echo "  ts link <카드ID>             기존 카드와 현재 세션 연결"
    echo "  ts unlink                    프로젝트-카드 연결 해제"
    echo "  ts info                      현재 세션/카드 정보"
    echo ""
    echo "📝 세션 관리:"
    echo "  ts title <제목>              카드 제목 변경"
    echo "  ts comment <내용>            코멘트 추가"
    echo "  ts status <상태>             상태 변경 (urgent/in_progress/paused/done)"
    echo "  ts list                      전체 세션 목록"
    echo "  ts get <카드ID>              카드 상세 정보"
    echo "  ts search [세션ID]           세션 ID로 카드 검색"
    echo ""
    echo "우선순위: urgent, in_progress (기본), paused, done"
    echo ""
    echo "💡 1 세션 = 1 카드 보장: init 시 기존 카드가 있으면 선택 요청"
}

# Main
case "$1" in
    auto)
        auto_connect
        ;;
    init)
        init_session "$2" "$3" "$4"
        ;;
    link)
        link_session "$2"
        ;;
    connect)
        connect_session
        ;;
    unlink)
        unlink_session
        ;;
    info)
        info_session
        ;;
    search)
        search_by_session "$2"
        ;;
    comment)
        add_comment "$2"
        ;;
    status)
        change_status "$2"
        ;;
    title)
        change_title "$2"
        ;;
    list)
        list_sessions
        ;;
    get)
        get_session "$2"
        ;;
    *)
        show_help
        ;;
esac
