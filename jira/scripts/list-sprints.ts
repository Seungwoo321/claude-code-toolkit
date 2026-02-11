#!/usr/bin/env npx tsx
/**
 * Jira 스프린트 목록 조회
 *
 * 사용법:
 *   npx tsx list-sprints.ts                    # 활성+예정 스프린트
 *   npx tsx list-sprints.ts --state active     # 활성 스프린트만
 *   npx tsx list-sprints.ts --state future     # 예정 스프린트만
 *   npx tsx list-sprints.ts --state closed     # 종료된 스프린트
 *   npx tsx list-sprints.ts --board 4933       # 특정 보드
 *
 * 출력:
 *   SprintListOutput JSON
 */

import {
  loadConfig,
  getAuth,
  callJiraApi,
  createError,
  outputJson,
  outputError,
} from './jira-api.js';
import type { JiraError } from './types.js';

interface Sprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  startDate?: string;
  endDate?: string;
  goal?: string;
}

interface SprintResponse {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: Sprint[];
}

interface SprintListOutput {
  total: number;
  boardId: number;
  boardName: string;
  sprints: Array<{
    id: number;
    name: string;
    state: string;
    startDate: string | null;
    endDate: string | null;
    isOverdue: boolean;
  }>;
}

interface ListSprintsArgs {
  state: string;
  boardId: number | null;
}

function parseArgs(): ListSprintsArgs {
  const args = process.argv.slice(2);
  const result: ListSprintsArgs = {
    state: 'active,future',
    boardId: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--state':
        result.state = args[++i];
        break;
      case '--board':
        result.boardId = parseInt(args[++i], 10);
        break;
    }
  }

  return result;
}

async function main() {
  try {
    const args = parseArgs();
    const config = loadConfig();
    const auth = getAuth(config);
    const baseUrl = config.jira.site;

    // 보드 결정
    const boards = config.jira.boards || [];
    let board = boards.find((b: any) => b.default) || boards[0];

    if (args.boardId) {
      board = boards.find((b: any) => b.id === args.boardId);
      if (!board) {
        board = { id: args.boardId, name: `Board ${args.boardId}` };
      }
    }

    if (!board) {
      throw createError('CONFIG_ERROR', 'No board configured in config.json');
    }

    // 스프린트 조회
    const response = await callJiraApi<SprintResponse>(
      baseUrl,
      'GET',
      `/rest/agile/1.0/board/${board.id}/sprint?state=${args.state}`,
      auth
    );

    const now = new Date();

    const output: SprintListOutput = {
      total: response.values.length,
      boardId: board.id,
      boardName: board.name,
      sprints: response.values.map((sprint) => {
        const endDate = sprint.endDate ? new Date(sprint.endDate) : null;
        const isOverdue = sprint.state === 'active' && endDate !== null && endDate < now;

        return {
          id: sprint.id,
          name: sprint.name,
          state: sprint.state,
          startDate: sprint.startDate || null,
          endDate: sprint.endDate || null,
          isOverdue,
        };
      }),
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
