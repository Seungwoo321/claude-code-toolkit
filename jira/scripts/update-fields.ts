#!/usr/bin/env npx tsx
/**
 * Jira 티켓 필드 업데이트 (시작일, 추정치 등)
 *
 * Usage:
 *   npx tsx update-fields.ts AS-1234 --start-date 2026-02-11
 *   npx tsx update-fields.ts AS-1234 --estimate 1h
 *   npx tsx update-fields.ts AS-1234 --start-date 2026-02-11 --estimate 2h
 */

import { loadConfig, getAuth, callJiraApi, outputJson, outputError, createError } from './jira-api.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    outputError(createError('INVALID_ARGS', 'Usage: update-fields.ts <issue-key> [--start-date YYYY-MM-DD] [--estimate 1h]'));
    return;
  }

  const issueKey = args[0];

  // 옵션 파싱
  let startDate: string | undefined;
  let estimate: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--start-date' && args[i + 1]) {
      startDate = args[++i];
    } else if (args[i] === '--estimate' && args[i + 1]) {
      estimate = args[++i];
    }
  }

  if (!startDate && !estimate) {
    outputError(createError('INVALID_ARGS', 'At least one of --start-date or --estimate is required'));
    return;
  }

  try {
    const config = loadConfig();
    const auth = getAuth(config);
    const baseUrl = config.jira.site;

    const fields: Record<string, any> = {};
    const changes: Record<string, string> = {};

    // 시작일 (customfield_10015는 Jira의 Start Date 필드)
    if (startDate) {
      fields.customfield_10015 = startDate;
      changes.startDate = startDate;
    }

    // 최초 추정치
    if (estimate) {
      fields.timetracking = { originalEstimate: estimate };
      changes.originalEstimate = estimate;
    }

    await callJiraApi(
      baseUrl,
      'PUT',
      `/rest/api/3/issue/${issueKey}`,
      auth,
      { fields }
    );

    outputJson({
      success: true,
      key: issueKey,
      changes,
      url: `${baseUrl}/browse/${issueKey}`
    });
  } catch (error) {
    outputError(error as any);
  }
}

main();
