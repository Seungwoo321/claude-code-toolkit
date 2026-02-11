#!/usr/bin/env npx tsx
/**
 * Jira 서브태스크 생성
 *
 * Usage: npx tsx create-subtask.ts <parent-key> "<summary>" [--assignee "이름"]
 */

import { loadConfig, getAuth, callJiraApi, findTeamMember, outputJson, outputError, createError } from './jira-api.js';

interface CreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    outputError(createError('INVALID_ARGS', 'Usage: create-subtask.ts <parent-key> "<summary>" [--assignee "이름"]'));
    return;
  }

  const parentKey = args[0];
  const summary = args[1];

  // --assignee 옵션 파싱
  let assigneeAccountId: string | undefined;
  const assigneeIndex = args.indexOf('--assignee');
  if (assigneeIndex !== -1 && args[assigneeIndex + 1]) {
    const config = loadConfig();
    const member = findTeamMember(config, args[assigneeIndex + 1]);
    if (member) {
      assigneeAccountId = member.accountId;
    }
  }

  try {
    const config = loadConfig();
    const auth = getAuth(config);
    const baseUrl = config.jira.site;

    const fields: Record<string, any> = {
      project: { key: config.jira.project },
      parent: { key: parentKey },
      summary: summary,
      issuetype: { name: '하위 작업' },
    };

    if (assigneeAccountId) {
      fields.assignee = { accountId: assigneeAccountId };
    }

    const response = await callJiraApi<CreateIssueResponse>(
      baseUrl,
      'POST',
      '/rest/api/3/issue',
      auth,
      { fields }
    );

    outputJson({
      success: true,
      key: response.key,
      summary: summary,
      parent: parentKey,
      url: `${baseUrl}/browse/${response.key}`
    });
  } catch (error) {
    outputError(error as any);
  }
}

main();
