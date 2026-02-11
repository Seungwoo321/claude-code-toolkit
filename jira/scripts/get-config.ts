#!/usr/bin/env npx tsx
/**
 * Jira 환경 설정 조회
 *
 * 사용법:
 *   npx tsx get-config.ts                    # 전체 환경 조회
 *   npx tsx get-config.ts --boards           # 보드 목록
 *   npx tsx get-config.ts --sprints          # 스프린트 목록
 *   npx tsx get-config.ts --fields           # 필드 목록
 *   npx tsx get-config.ts --issue-types      # 이슈 타입 목록
 *   npx tsx get-config.ts --project AS       # 특정 프로젝트
 *
 * 출력:
 *   ConfigInfo JSON
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MinimalConfig {
  auth?: {
    email: string;
    apiToken: string;
  };
  jira?: {
    site: string;
    project: string;
  };
}

interface Board {
  id: number;
  name: string;
  type: string;
}

interface Sprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

interface Field {
  id: string;
  name: string;
  type: string;
  required: boolean;
  custom: boolean;
}

interface IssueType {
  id: string;
  name: string;
  subtask: boolean;
}

interface ConfigInfo {
  project: {
    key: string;
    name: string;
    id: string;
  } | null;
  boards: Board[];
  sprints: Sprint[];
  issueTypes: IssueType[];
  fields: {
    standard: Field[];
    custom: Field[];
  };
  currentConfig: {
    hasAuth: boolean;
    hasSite: boolean;
    hasProject: boolean;
    hasBoards: boolean;
  };
}

interface Args {
  boards: boolean;
  sprints: boolean;
  fields: boolean;
  issueTypes: boolean;
  project: string | null;
  all: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    boards: false,
    sprints: false,
    fields: false,
    issueTypes: false,
    project: null,
    all: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--boards':
        result.boards = true;
        result.all = false;
        break;
      case '--sprints':
        result.sprints = true;
        result.all = false;
        break;
      case '--fields':
        result.fields = true;
        result.all = false;
        break;
      case '--issue-types':
        result.issueTypes = true;
        result.all = false;
        break;
      case '--project':
        result.project = args[++i];
        break;
    }
  }

  return result;
}

function loadMinimalConfig(): MinimalConfig {
  const configPath = join(__dirname, '..', 'config.json');
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return {};
}

function getAuth(config: MinimalConfig): { email: string; token: string } | null {
  const envEmail = process.env.JIRA_EMAIL;
  const envToken = process.env.JIRA_API_TOKEN;

  if (envEmail && envToken) {
    return { email: envEmail, token: envToken };
  }

  if (config.auth?.email && config.auth?.apiToken) {
    return { email: config.auth.email, token: config.auth.apiToken };
  }

  return null;
}

async function callApi<T>(baseUrl: string, endpoint: string, authString: string): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json',
    },
  });

  if (response.ok === false) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getProject(baseUrl: string, authString: string, projectKey: string) {
  try {
    const data = await callApi<any>(baseUrl, `/rest/api/3/project/${projectKey}`, authString);
    return {
      key: data.key,
      name: data.name,
      id: data.id,
    };
  } catch {
    return null;
  }
}

async function getBoards(baseUrl: string, authString: string, projectKey: string): Promise<Board[]> {
  try {
    const data = await callApi<any>(baseUrl, `/rest/agile/1.0/board?projectKeyOrId=${projectKey}`, authString);
    return (data.values || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      type: b.type,
    }));
  } catch {
    return [];
  }
}

async function getSprints(baseUrl: string, authString: string, boardId: number): Promise<Sprint[]> {
  try {
    const data = await callApi<any>(baseUrl, `/rest/agile/1.0/board/${boardId}/sprint?state=active,future`, authString);
    return (data.values || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      startDate: s.startDate,
      endDate: s.endDate,
    }));
  } catch {
    return [];
  }
}

async function getIssueTypes(baseUrl: string, authString: string, projectKey: string): Promise<IssueType[]> {
  try {
    const data = await callApi<any>(baseUrl, `/rest/api/3/issue/createmeta/${projectKey}/issuetypes`, authString);
    return (data.issueTypes || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      subtask: t.subtask || false,
    }));
  } catch {
    return [];
  }
}

async function getFields(baseUrl: string, authString: string, projectKey: string, issueTypeId: string): Promise<{ standard: Field[]; custom: Field[] }> {
  try {
    const data = await callApi<any>(baseUrl, `/rest/api/3/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`, authString);
    const fields = data.fields || [];

    const standard: Field[] = [];
    const custom: Field[] = [];

    for (const f of fields) {
      const isCustom = f.fieldId.startsWith('customfield_');
      const field: Field = {
        id: f.fieldId,
        name: f.name,
        type: f.schema?.type || 'unknown',
        required: f.required || false,
        custom: isCustom,
      };

      if (isCustom) {
        custom.push(field);
      } else {
        standard.push(field);
      }
    }

    return { standard, custom };
  } catch (e) {
    console.error('getFields error:', e);
    return { standard: [], custom: [] };
  }
}

async function main() {
  try {
    const args = parseArgs();
    const config = loadMinimalConfig();
    const auth = getAuth(config);

    // 현재 설정 상태 확인
    const currentConfig = {
      hasAuth: auth !== null,
      hasSite: Boolean(config.jira?.site),
      hasProject: Boolean(config.jira?.project),
      hasBoards: Boolean((config as any).jira?.boards?.length),
    };

    if (auth === null) {
      console.log(JSON.stringify({
        error: 'AUTH_MISSING',
        message: '인증 정보가 없습니다. config.json에 auth 섹션을 추가하세요.',
        currentConfig,
      }, null, 2));
      process.exit(1);
    }

    const baseUrl = config.jira?.site || process.env.JIRA_SITE;
    if (baseUrl === undefined) {
      console.log(JSON.stringify({
        error: 'SITE_MISSING',
        message: 'Jira 사이트 URL이 없습니다. config.json에 jira.site를 추가하세요.',
        currentConfig,
      }, null, 2));
      process.exit(1);
    }

    const projectKey = args.project || config.jira?.project;
    if (projectKey === undefined) {
      console.log(JSON.stringify({
        error: 'PROJECT_MISSING',
        message: '프로젝트 키가 없습니다. --project 옵션 또는 config.json에 jira.project를 추가하세요.',
        currentConfig,
      }, null, 2));
      process.exit(1);
    }

    const authString = Buffer.from(`${auth.email}:${auth.token}`).toString('base64');

    const result: ConfigInfo = {
      project: null,
      boards: [],
      sprints: [],
      issueTypes: [],
      fields: { standard: [], custom: [] },
      currentConfig,
    };

    // 프로젝트 정보 조회
    result.project = await getProject(baseUrl, authString, projectKey);

    // 보드 조회
    if (args.all || args.boards) {
      result.boards = await getBoards(baseUrl, authString, projectKey);
    }

    // 스프린트 조회 (첫 번째 보드 기준)
    if (args.all || args.sprints) {
      if (result.boards.length === 0) {
        result.boards = await getBoards(baseUrl, authString, projectKey);
      }
      if (result.boards.length > 0) {
        result.sprints = await getSprints(baseUrl, authString, result.boards[0].id);
      }
    }

    // 이슈 타입 조회
    if (args.all || args.issueTypes) {
      result.issueTypes = await getIssueTypes(baseUrl, authString, projectKey);
    }

    // 필드 조회 (스토리 타입 기준)
    if (args.all || args.fields) {
      if (result.issueTypes.length === 0) {
        result.issueTypes = await getIssueTypes(baseUrl, authString, projectKey);
      }
      const storyType = result.issueTypes.find(t => t.name === '스토리' || t.name === 'Story');
      if (storyType) {
        result.fields = await getFields(baseUrl, authString, projectKey, storyType.id);
      }
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      error: 'UNKNOWN_ERROR',
      message: String(error),
    }, null, 2));
    process.exit(1);
  }
}

main();
