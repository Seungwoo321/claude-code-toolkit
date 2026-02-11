#!/usr/bin/env npx tsx
/**
 * 브랜치명에서 Jira 티켓 번호 추출
 *
 * 사용법:
 *   npx tsx parse-branch.ts                              # 현재 브랜치
 *   npx tsx parse-branch.ts "feature/AS-1234/desc"       # 직접 입력
 *
 * 출력:
 *   { branch, ticket, type, description }
 */

import { execSync } from 'child_process';
import { loadConfig, createError, outputJson, outputError } from './jira-api.js';
import type { ParsedBranch, JiraError } from './types.js';

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    throw createError('BRANCH_NO_TICKET', 'Not a git repository or no branch checked out');
  }
}

function parseBranch(branchName: string, patterns: string[], ticketRegex: string): ParsedBranch {
  // 패턴 기반 파싱 시도
  for (const pattern of patterns) {
    const regex = new RegExp(pattern);
    const match = branchName.match(regex);

    if (match?.groups) {
      return {
        branch: branchName,
        ticket: match.groups.ticket || null,
        type: match.groups.type || null,
        description: match.groups.desc || null,
      };
    }
  }

  // 패턴 매칭 실패 시, 티켓 번호만이라도 추출 시도
  const ticketMatch = branchName.match(new RegExp(ticketRegex));
  if (ticketMatch) {
    return {
      branch: branchName,
      ticket: ticketMatch[0],
      type: null,
      description: null,
    };
  }

  // 티켓 번호 없음
  return {
    branch: branchName,
    ticket: null,
    type: null,
    description: null,
    error: `No ticket number found in branch name. Recommended format: feature/AS-1234/description`,
  };
}

async function main() {
  try {
    const config = loadConfig();
    const branchPatterns = config.branch?.patterns || [
      '^(?<type>feature|bugfix|hotfix|chore)/(?<ticket>AS-\\d+)/(?<desc>.*)$',
      '^(?<type>feature|bugfix|hotfix|chore)/(?<ticket>AS-\\d+)$',
    ];
    const ticketRegex = config.branch?.ticketRegex || 'AS-\\d+';

    // 인자로 브랜치명이 전달되었으면 사용, 아니면 현재 브랜치
    const branchName = process.argv[2] || getCurrentBranch();

    const result = parseBranch(branchName, branchPatterns, ticketRegex);
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
