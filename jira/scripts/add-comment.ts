#!/usr/bin/env npx tsx
/**
 * Jira 티켓에 코멘트 추가
 *
 * 사용법:
 *   npx tsx add-comment.ts AS-1234 "코멘트 내용"
 *   npx tsx add-comment.ts --from-branch "코멘트 내용"
 *
 * 출력:
 *   CommentResult JSON
 */

import { execSync } from 'child_process';
import {
  loadConfig,
  getAuth,
  addComment,
  createError,
  outputJson,
  outputError,
} from './jira-api.js';
import type { CommentResult, JiraError, ParsedBranch } from './types.js';

interface CommentArgs {
  issueKey: string | null;
  fromBranch: boolean;
  body: string | null;
}

function parseArgs(): CommentArgs {
  const args = process.argv.slice(2);
  const result: CommentArgs = {
    issueKey: null,
    fromBranch: false,
    body: null,
  };

  const nonFlagArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--from-branch') {
      result.fromBranch = true;
    } else if (arg.match(/^[A-Z]+-\d+$/)) {
      result.issueKey = arg;
    } else if (!arg.startsWith('--')) {
      nonFlagArgs.push(arg);
    }
  }

  // 마지막 non-flag 인자가 코멘트 내용
  if (nonFlagArgs.length > 0) {
    // 이슈 키가 아닌 것들을 코멘트로 처리
    const commentParts = nonFlagArgs.filter((a) => !a.match(/^[A-Z]+-\d+$/));
    if (commentParts.length > 0) {
      result.body = commentParts.join(' ');
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

    // 코멘트 내용 확인
    if (!args.body) {
      throw createError('UNKNOWN_ERROR', 'No comment body provided');
    }

    // 코멘트 추가
    const response = await addComment(baseUrl, auth, ticketKey, args.body);

    const result: CommentResult = {
      success: true,
      key: ticketKey,
      commentId: response.id,
      url: `${baseUrl}/browse/${ticketKey}`,
    };

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
