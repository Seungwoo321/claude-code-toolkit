#!/usr/bin/env npx tsx
/**
 * Jira 티켓 상세 조회
 *
 * 사용법:
 *   npx tsx get-issue.ts AS-1234              # 특정 티켓
 *   npx tsx get-issue.ts --from-branch        # 현재 브랜치에서 추출
 *
 * 출력:
 *   IssueOutput JSON
 */

import { execSync } from 'child_process';
import {
  loadConfig,
  getAuth,
  getIssue,
  getTeamMemberName,
  adfToText,
  createError,
  outputJson,
  outputError,
} from './jira-api.js';
import type { IssueOutput, JiraError, ParsedBranch } from './types.js';

function parseArgs(): { issueKey: string | null; fromBranch: boolean } {
  const args = process.argv.slice(2);
  let issueKey: string | null = null;
  let fromBranch = false;

  for (const arg of args) {
    if (arg === '--from-branch') {
      fromBranch = true;
    } else if (arg.match(/^[A-Z]+-\d+$/)) {
      issueKey = arg;
    }
  }

  return { issueKey, fromBranch };
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
        `Branch: ${parsed.branch}\nRecommended format: feature/AS-1234/description`
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
    const { issueKey, fromBranch } = parseArgs();
    const config = loadConfig();
    const auth = getAuth();

    // 티켓 번호 결정
    let ticketKey: string;
    if (issueKey) {
      ticketKey = issueKey;
    } else if (fromBranch) {
      ticketKey = getTicketFromBranch();
    } else {
      // 인자 없으면 현재 브랜치에서 추출 시도
      ticketKey = getTicketFromBranch();
    }

    const baseUrl = config.jira.site;
    const fields = config.jira.fields?.default || [
      'summary',
      'status',
      'assignee',
      'reporter',
      'issuetype',
      'priority',
      'parent',
      'subtasks',
      'created',
      'updated',
      'labels',
      'description',
      'comment',
    ];

    const issue = await getIssue(baseUrl, auth, ticketKey, fields);

    // 출력 형식으로 변환
    const output: IssueOutput = {
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description ? adfToText(issue.fields.description) : null,
      status: issue.fields.status.name,
      statusCategory: issue.fields.status.statusCategory.name,
      assignee: issue.fields.assignee
        ? {
            name: getTeamMemberName(config, issue.fields.assignee.accountId),
            accountId: issue.fields.assignee.accountId,
          }
        : null,
      reporter: issue.fields.reporter
        ? {
            name: getTeamMemberName(config, issue.fields.reporter.accountId),
            accountId: issue.fields.reporter.accountId,
          }
        : null,
      issuetype: issue.fields.issuetype.name,
      priority: issue.fields.priority?.name || null,
      parent: issue.fields.parent
        ? {
            key: issue.fields.parent.key,
            summary: issue.fields.parent.fields.summary,
          }
        : null,
      subtasks: (issue.fields.subtasks || []).map((st) => ({
        key: st.key,
        summary: st.fields.summary,
        status: st.fields.status.name,
      })),
      labels: issue.fields.labels || [],
      created: issue.fields.created,
      updated: issue.fields.updated,
      comments: (issue.fields.comment?.comments || [])
        .slice(-(config.defaults?.includeComments || 5))
        .map((c) => ({
          id: c.id,
          author: c.author.displayName,
          body: adfToText(c.body),
          created: c.created,
        })),
      url: `${baseUrl}/browse/${issue.key}`,
    };

    outputJson(output);
  } catch (error) {
    if ((error as JiraError).error) {
      outputError(error as JiraError);
    } else {
      outputError(createError('UNKNOWN_ERROR', String(error)));
    }
  }
}

main();
