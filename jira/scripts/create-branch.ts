#!/usr/bin/env npx tsx
/**
 * Jira 티켓 기반 Git 브랜치 생성
 *
 * Usage: npx tsx create-branch.ts AS-1234 "short-description"
 *
 * 이슈 타입에 따라 prefix 자동 결정:
 * - Bug → bugfix/
 * - 하위 작업 (리팩토링 상위) → refactor/
 * - 그 외 → feature/
 */

import { loadConfig, getAuth, getIssue, outputJson, outputError, createError } from './jira-api.js';
import { execSync } from 'child_process';

function determineBranchPrefix(issue: any): string {
  const issueType = issue.fields.issuetype?.name?.toLowerCase() || '';
  const parentSummary = issue.fields.parent?.fields?.summary?.toLowerCase() || '';

  // Bug 타입
  if (issueType === 'bug' || issueType === '버그') {
    return 'bugfix';
  }

  // 리팩토링 관련 (상위 태스크 또는 본인이 리팩토링)
  if (
    parentSummary.includes('리팩토링') ||
    parentSummary.includes('refactor') ||
    issue.fields.summary?.toLowerCase().includes('리팩토링') ||
    issue.fields.summary?.toLowerCase().includes('refactor')
  ) {
    return 'refactor';
  }

  // Hotfix (긴급)
  if (
    issue.fields.priority?.name === 'Highest' ||
    issue.fields.summary?.toLowerCase().includes('hotfix') ||
    issue.fields.summary?.toLowerCase().includes('긴급')
  ) {
    return 'hotfix';
  }

  // 기본값: feature
  return 'feature';
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    outputError(createError('INVALID_ARGS', 'Usage: create-branch.ts <issue-key> <description>'));
    return;
  }

  const issueKey = args[0];
  const description = args[1]
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  try {
    const config = loadConfig();
    const auth = getAuth(config);
    const baseUrl = config.jira.site;

    // 이슈 조회
    const issue = await getIssue(baseUrl, auth, issueKey, [
      'summary',
      'issuetype',
      'parent',
      'priority',
    ]);

    // prefix 결정
    const prefix = determineBranchPrefix(issue);
    const branchName = `${prefix}/${issueKey}/${description}`;

    // 현재 브랜치 확인
    let currentBranch: string;
    try {
      currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    } catch {
      outputError(createError('GIT_ERROR', 'Git 저장소가 아닙니다'));
      return;
    }

    // 브랜치 생성
    try {
      execSync(`git checkout -b ${branchName}`, { encoding: 'utf-8' });
    } catch (error) {
      outputError(createError('GIT_ERROR', `브랜치 생성 실패: ${error}`));
      return;
    }

    outputJson({
      success: true,
      branch: branchName,
      previousBranch: currentBranch,
      issue: {
        key: issueKey,
        summary: issue.fields.summary,
        type: issue.fields.issuetype?.name,
        parent: issue.fields.parent?.key,
      },
      url: `${baseUrl}/browse/${issueKey}`,
    });
  } catch (error) {
    outputError(error as any);
  }
}

main();
