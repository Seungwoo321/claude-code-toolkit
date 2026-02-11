#!/usr/bin/env npx tsx
/**
 * Jira 스킬 설정 초기화/업데이트
 *
 * 사용법:
 *   npx tsx init-config.ts --site "https://xxx.atlassian.net" --project AS
 *   npx tsx init-config.ts --auth "email" "token"
 *   npx tsx init-config.ts --add-board 4933 "AS 보드"
 *   npx tsx init-config.ts --add-field startDate customfield_11802
 *   npx tsx init-config.ts --show                    # 현재 설정 표시
 *
 * 출력:
 *   InitResult JSON
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '..', 'config.json');

interface Config {
  $schema?: string;
  version?: string;
  auth?: {
    email: string;
    apiToken: string;
  };
  jira: {
    site: string;
    project: string;
    boards?: Array<{ id: number; name: string; default?: boolean }>;
    fields?: {
      default?: string[];
      list?: string[];
      mapping?: Record<string, string>;
    };
    statusMapping?: Record<string, string[]>;
  };
  branch?: {
    patterns?: string[];
    ticketRegex?: string;
    recommended?: string;
  };
  team?: {
    members?: Array<{
      name: string;
      aliases?: string[];
      accountId: string;
    }>;
  };
  defaults?: Record<string, any>;
  list?: {
    excludeStatuses?: string[];
    includeStatuses?: string[];
  };
}

interface Args {
  show: boolean;
  site: string | null;
  project: string | null;
  authEmail: string | null;
  authToken: string | null;
  addBoard: { id: number; name: string } | null;
  addField: { key: string; fieldId: string } | null;
  addMember: { name: string; accountId: string } | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    show: false,
    site: null,
    project: null,
    authEmail: null,
    authToken: null,
    addBoard: null,
    addField: null,
    addMember: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--show':
        result.show = true;
        break;
      case '--site':
        result.site = args[++i];
        break;
      case '--project':
        result.project = args[++i];
        break;
      case '--auth':
        result.authEmail = args[++i];
        result.authToken = args[++i];
        break;
      case '--add-board':
        result.addBoard = {
          id: parseInt(args[++i], 10),
          name: args[++i],
        };
        break;
      case '--add-field':
        result.addField = {
          key: args[++i],
          fieldId: args[++i],
        };
        break;
      case '--add-member':
        result.addMember = {
          name: args[++i],
          accountId: args[++i],
        };
        break;
    }
  }

  return result;
}

function loadConfig(): Config {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  }

  // 기본 템플릿
  return {
    $schema: './schemas/config.schema.json',
    version: '1.0.0',
    jira: {
      site: '',
      project: '',
      boards: [],
      fields: {
        default: ['summary', 'status', 'assignee', 'reporter', 'issuetype', 'priority', 'parent', 'subtasks', 'created', 'updated', 'labels', 'description', 'comment'],
        list: ['summary', 'status', 'assignee', 'issuetype', 'updated'],
        mapping: {},
      },
      statusMapping: {
        todo: ['To Do', 'Open', 'Backlog', '해야 할 일'],
        in_progress: ['In Progress', '진행 중', '진행중'],
        in_review: ['In Review', '리뷰', 'Review', '검토'],
        done: ['Done', '완료', 'Closed', 'Resolved'],
      },
    },
    branch: {
      patterns: [
        '^(?<type>feature|bugfix|hotfix|chore|fix|refactor)/(?<ticket>[A-Z]+-\\d+)/(?<desc>.*)$',
        '^(?<type>feature|bugfix|hotfix|chore|fix|refactor)/(?<ticket>[A-Z]+-\\d+)$',
        '^(?<ticket>[A-Z]+-\\d+)/(?<desc>.*)$',
        '^(?<ticket>[A-Z]+-\\d+)$',
      ],
      ticketRegex: '[A-Z]+-\\d+',
      recommended: 'feature/{PROJECT}-1234/short-description',
    },
    team: {
      members: [],
    },
    defaults: {
      listLimit: 20,
      includeSubtasks: true,
      includeComments: 5,
    },
    list: {
      excludeStatuses: [],
      includeStatuses: [],
    },
  };
}

function saveConfig(config: Config): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function main() {
  const args = parseArgs();
  let config = loadConfig();
  let modified = false;

  // 사이트 설정
  if (args.site) {
    config.jira.site = args.site;
    modified = true;
  }

  // 프로젝트 설정
  if (args.project) {
    config.jira.project = args.project;
    // 브랜치 패턴에 프로젝트 키 반영
    if (config.branch) {
      config.branch.ticketRegex = `${args.project}-\\d+`;
      config.branch.recommended = `feature/${args.project}-1234/short-description`;
    }
    modified = true;
  }

  // 인증 설정
  if (args.authEmail && args.authToken) {
    config.auth = {
      email: args.authEmail,
      apiToken: args.authToken,
    };
    modified = true;
  }

  // 보드 추가
  if (args.addBoard) {
    if (config.jira.boards === undefined) {
      config.jira.boards = [];
    }
    const existing = config.jira.boards.find(b => b.id === args.addBoard?.id);
    if (existing === undefined) {
      const isFirst = config.jira.boards.length === 0;
      config.jira.boards.push({
        id: args.addBoard.id,
        name: args.addBoard.name,
        default: isFirst,
      });
      modified = true;
    }
  }

  // 필드 매핑 추가
  if (args.addField) {
    if (config.jira.fields === undefined) {
      config.jira.fields = { mapping: {} };
    }
    if (config.jira.fields.mapping === undefined) {
      config.jira.fields.mapping = {};
    }
    config.jira.fields.mapping[args.addField.key] = args.addField.fieldId;
    modified = true;
  }

  // 팀 멤버 추가
  if (args.addMember) {
    if (config.team === undefined) {
      config.team = { members: [] };
    }
    if (config.team.members === undefined) {
      config.team.members = [];
    }
    const existing = config.team.members.find(m => m.accountId === args.addMember?.accountId);
    if (existing === undefined) {
      config.team.members.push({
        name: args.addMember.name,
        accountId: args.addMember.accountId,
      });
      modified = true;
    }
  }

  // 저장
  if (modified) {
    saveConfig(config);
  }

  // 결과 출력
  const result = {
    modified,
    configPath: CONFIG_PATH,
    config: args.show ? config : {
      site: config.jira.site,
      project: config.jira.project,
      hasAuth: Boolean(config.auth?.email && config.auth?.apiToken),
      boardCount: config.jira.boards?.length || 0,
      memberCount: config.team?.members?.length || 0,
      fieldMappings: Object.keys(config.jira.fields?.mapping || {}),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main();
