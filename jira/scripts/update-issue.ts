#!/usr/bin/env npx tsx
/**
 * Jira 티켓 업데이트 (상태/할당 변경)
 *
 * 사용법:
 *   npx tsx update-issue.ts AS-1234 --status "In Progress"
 *   npx tsx update-issue.ts AS-1234 --assignee "이수민"
 *   npx tsx update-issue.ts --from-branch --status "In Review"
 *   npx tsx update-issue.ts AS-1234 --status "Done" --assignee "이승우"
 *   npx tsx update-issue.ts AS-1234 --status "진행중"    # 한국어 지원
 *   npx tsx update-issue.ts AS-1234 --dry-run --status "Done"  # 테스트
 *
 * 출력:
 *   UpdateResult JSON
 */

import { execSync } from 'child_process';
import {
  loadConfig,
  getAuth,
  getIssue,
  updateIssue,
  getTransitions,
  doTransition,
  findTeamMember,
  getTeamMemberName,
  normalizeStatus,
  createError,
  outputJson,
  outputError,
} from './jira-api.js';
import type { UpdateResult, JiraError, ParsedBranch } from './types.js';

interface UpdateArgs {
  issueKey: string | null;
  fromBranch: boolean;
  status: string | null;
  assignee: string | null;
  dryRun: boolean;
}

function parseArgs(): UpdateArgs {
  const args = process.argv.slice(2);
  const result: UpdateArgs = {
    issueKey: null,
    fromBranch: false,
    status: null,
    assignee: null,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--from-branch') {
      result.fromBranch = true;
    } else if (arg === '--status') {
      result.status = args[++i];
    } else if (arg === '--assignee') {
      result.assignee = args[++i];
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.match(/^[A-Z]+-\d+$/)) {
      result.issueKey = arg;
    }
  }

  return result;
}

function getTicketFromBranch(): string {
  try {
    const result = execSync('npx tsx ~/.claude/skills/jira/scripts/parse-branch.ts', {
      encoding: 'utf-8',
    });
    const parsed: ParsedBranch = JSON.parse(result);

    if (!parsed.ticket) {
      throw createError(
        'BRANCH_NO_TICKET',
        'No ticket number found in current branch',
        `Branch: ${parsed.branch}`
      );
    }

    return parsed.ticket;
  } catch (error) {
    if ((error as JiraError).error) {
      throw error;
    }
    throw createError('BRANCH_NO_TICKET', 'Failed to parse branch name', String(error));
  }
}

async function main() {
  try {
    const args = parseArgs();
    const config = loadConfig();
    const auth = getAuth();
    const baseUrl = config.jira.site;

    // 티켓 번호 결정
    let ticketKey: string;
    if (args.issueKey) {
      ticketKey = args.issueKey;
    } else if (args.fromBranch) {
      ticketKey = getTicketFromBranch();
    } else {
      throw createError('TICKET_NOT_FOUND', 'No ticket specified. Use AS-1234 or --from-branch');
    }

    // 변경사항 확인
    if (!args.status && !args.assignee) {
      throw createError('UNKNOWN_ERROR', 'No changes specified. Use --status or --assignee');
    }

    // 현재 이슈 정보 조회
    const currentIssue = await getIssue(baseUrl, auth, ticketKey, [
      'status',
      'assignee',
    ]);

    const changes: Record<string, { from: string; to: string }> = {};

    // 상태 변경
    if (args.status) {
      const targetStatus = normalizeStatus(config, args.status) || args.status;
      const currentStatus = currentIssue.fields.status.name;

      if (currentStatus !== targetStatus) {
        // 가능한 전환 조회
        const transitionsResponse = await getTransitions(baseUrl, auth, ticketKey);
        const transition = transitionsResponse.transitions.find(
          (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase() ||
                 t.name.toLowerCase() === targetStatus.toLowerCase()
        );

        if (!transition) {
          const availableTransitions = transitionsResponse.transitions
            .map((t) => t.to.name)
            .join(', ');
          throw createError(
            'INVALID_TRANSITION',
            `Cannot transition to "${targetStatus}"`,
            `Available transitions: ${availableTransitions}`
          );
        }

        if (!args.dryRun) {
          await doTransition(baseUrl, auth, ticketKey, transition.id);
        }

        changes['status'] = { from: currentStatus, to: transition.to.name };
      }
    }

    // 담당자 변경
    if (args.assignee) {
      const member = findTeamMember(config, args.assignee);
      const targetAccountId = member?.accountId || args.assignee;
      const targetName = member?.name || args.assignee;

      const currentAssignee = currentIssue.fields.assignee;
      const currentName = currentAssignee
        ? getTeamMemberName(config, currentAssignee.accountId)
        : 'Unassigned';

      if (currentAssignee?.accountId !== targetAccountId) {
        if (!args.dryRun) {
          await updateIssue(baseUrl, auth, ticketKey, {
            assignee: { accountId: targetAccountId },
          });
        }

        changes['assignee'] = { from: currentName, to: targetName };
      }
    }

    const result: UpdateResult = {
      success: true,
      key: ticketKey,
      changes,
      url: `${baseUrl}/browse/${ticketKey}`,
    };

    if (args.dryRun) {
      (result as any).dryRun = true;
      (result as any).message = 'Dry run - no changes made';
    }

    if (Object.keys(changes).length === 0) {
      (result as any).message = 'No changes needed - already in desired state';
    }

    outputJson(result);
  } catch (error) {
    if ((error as JiraError).error) {
      outputError(error as JiraError);
    } else {
      outputError(createError('UNKNOWN_ERROR', String(error)));
    }
  }
}

main();
