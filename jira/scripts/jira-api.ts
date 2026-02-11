#!/usr/bin/env npx tsx
/**
 * Jira REST API 공통 래퍼
 *
 * 환경 변수:
 *   JIRA_EMAIL - Atlassian 계정 이메일
 *   JIRA_API_TOKEN - Jira API 토큰
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type {
  JiraConfig,
  JiraIssue,
  JiraSearchResponse,
  JiraTransitionsResponse,
  JiraError,
  TeamMember,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== Config 로드 =====

export function loadConfig(): JiraConfig {
  // 1. 스킬 전용 config 확인
  const skillConfigPath = join(__dirname, '..', 'config.json');
  if (existsSync(skillConfigPath)) {
    return JSON.parse(readFileSync(skillConfigPath, 'utf-8'));
  }

  // 2. 공용 config 확인 (weekly-report와 공유)
  const sharedConfigPath = join(__dirname, '..', '..', 'config.json');
  if (existsSync(sharedConfigPath)) {
    return JSON.parse(readFileSync(sharedConfigPath, 'utf-8'));
  }

  throw createError('CONFIG_ERROR', 'config.json not found', `Checked: ${skillConfigPath}, ${sharedConfigPath}`);
}

// ===== 인증 =====

export interface JiraAuth {
  email: string;
  token: string;
}

export function getAuth(config?: JiraConfig): JiraAuth {
  // 1. 환경변수 우선
  const envEmail = process.env.JIRA_EMAIL;
  const envToken = process.env.JIRA_API_TOKEN;

  if (envEmail && envToken) {
    return { email: envEmail, token: envToken };
  }

  // 2. config에서 읽기
  const cfg = config ?? loadConfig();
  if (cfg.auth?.email && cfg.auth?.apiToken) {
    return { email: cfg.auth.email, token: cfg.auth.apiToken };
  }

  throw createError(
    'AUTH_MISSING',
    'Jira 인증 정보가 없습니다',
    'config.json에 auth 섹션을 추가하거나 환경변수를 설정하세요:\n  "auth": { "email": "...", "apiToken": "..." }'
  );
}

// ===== API 호출 =====

export async function callJiraApi<T>(
  baseUrl: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  auth: JiraAuth,
  body?: object
): Promise<T> {
  const url = `${baseUrl}${endpoint}`;
  const authString = Buffer.from(`${auth.email}:${auth.token}`).toString('base64');

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401) {
        throw createError('AUTH_INVALID', 'Invalid credentials', errorText);
      }
      if (response.status === 403) {
        throw createError('PERMISSION_DENIED', 'Permission denied', errorText);
      }
      if (response.status === 404) {
        throw createError('TICKET_NOT_FOUND', 'Issue not found', errorText);
      }

      throw createError(
        'UNKNOWN_ERROR',
        `Jira API error: ${response.status} ${response.statusText}`,
        errorText
      );
    }

    // DELETE 요청 등은 body가 없을 수 있음
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  } catch (error) {
    if ((error as JiraError).error) {
      throw error;
    }
    throw createError('NETWORK_ERROR', 'Failed to connect to Jira', String(error));
  }
}

// ===== JQL 검색 =====

export async function searchIssues(
  baseUrl: string,
  auth: JiraAuth,
  jql: string,
  fields: string[],
  maxResults: number = 50
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      jql,
      fields: fields.join(','),
      maxResults: maxResults.toString(),
    });

    if (nextPageToken) {
      params.set('nextPageToken', nextPageToken);
    }

    const response = await callJiraApi<JiraSearchResponse>(
      baseUrl,
      'GET',
      `/rest/api/3/search/jql?${params.toString()}`,
      auth
    );

    allIssues.push(...response.issues);

    // maxResults에 도달하면 중단 (limit 역할)
    if (!response.nextPageToken || allIssues.length >= response.total || allIssues.length >= maxResults) {
      break;
    }
    nextPageToken = response.nextPageToken;
  }

  // maxResults 개수만큼만 반환
  return allIssues.slice(0, maxResults);
}

// ===== 단일 이슈 조회 =====

export async function getIssue(
  baseUrl: string,
  auth: JiraAuth,
  issueKey: string,
  fields: string[]
): Promise<JiraIssue> {
  const params = new URLSearchParams({
    fields: fields.join(','),
    expand: 'renderedFields',
  });

  return callJiraApi<JiraIssue>(
    baseUrl,
    'GET',
    `/rest/api/3/issue/${issueKey}?${params.toString()}`,
    auth
  );
}

// ===== 이슈 수정 =====

export async function updateIssue(
  baseUrl: string,
  auth: JiraAuth,
  issueKey: string,
  fields: Record<string, any>
): Promise<void> {
  await callJiraApi(
    baseUrl,
    'PUT',
    `/rest/api/3/issue/${issueKey}`,
    auth,
    { fields }
  );
}

// ===== 상태 전환 =====

export async function getTransitions(
  baseUrl: string,
  auth: JiraAuth,
  issueKey: string
): Promise<JiraTransitionsResponse> {
  return callJiraApi<JiraTransitionsResponse>(
    baseUrl,
    'GET',
    `/rest/api/3/issue/${issueKey}/transitions`,
    auth
  );
}

export async function doTransition(
  baseUrl: string,
  auth: JiraAuth,
  issueKey: string,
  transitionId: string
): Promise<void> {
  await callJiraApi(
    baseUrl,
    'POST',
    `/rest/api/3/issue/${issueKey}/transitions`,
    auth,
    { transition: { id: transitionId } }
  );
}

// ===== 코멘트 =====

export async function addComment(
  baseUrl: string,
  auth: JiraAuth,
  issueKey: string,
  body: string
): Promise<{ id: string }> {
  // Atlassian Document Format으로 변환
  const adfBody = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: body }],
      },
    ],
  };

  return callJiraApi<{ id: string }>(
    baseUrl,
    'POST',
    `/rest/api/3/issue/${issueKey}/comment`,
    auth,
    { body: adfBody }
  );
}

// ===== 헬퍼 함수 =====

export function findTeamMember(config: JiraConfig, nameOrAlias: string): TeamMember | null {
  const normalized = nameOrAlias.toLowerCase().trim();

  for (const member of config.team.members) {
    // 정확한 이름 매칭
    if (member.name.toLowerCase() === normalized) {
      return member;
    }
    // Jira 이름 매칭
    if (member.jira?.toLowerCase() === normalized) {
      return member;
    }
    // 별칭 매칭
    if (member.aliases?.some((a) => a.toLowerCase() === normalized)) {
      return member;
    }
  }

  return null;
}

export function getTeamMemberName(config: JiraConfig, accountId: string): string {
  const member = config.team.members.find((m) => m.accountId === accountId);
  return member?.name ?? 'Unknown';
}

export function normalizeStatus(config: JiraConfig, input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // 한국어/영어 매핑
  const koreanMapping: Record<string, string> = {
    할일: 'todo',
    '해야할일': 'todo',
    시작: 'in_progress',
    진행: 'in_progress',
    진행중: 'in_progress',
    리뷰: 'in_review',
    검토: 'in_review',
    완료: 'done',
    종료: 'done',
  };

  const statusKey = koreanMapping[normalized] ?? normalized;

  // statusMapping에서 실제 Jira 상태 찾기
  for (const [key, values] of Object.entries(config.jira.statusMapping)) {
    if (key === statusKey) {
      return values[0]; // 첫 번째 값이 기본 Jira 상태
    }
    // 값 중에 매칭되는 것이 있는지 확인
    if (values.some((v) => v.toLowerCase() === normalized)) {
      return values[0];
    }
  }

  return null;
}

// ===== ADF → 텍스트 변환 =====

export function adfToText(adf: any): string {
  if (!adf || !adf.content) return '';

  function processNode(node: any): string {
    if (node.type === 'text') {
      return node.text || '';
    }
    if (node.content) {
      return node.content.map(processNode).join('');
    }
    if (node.type === 'hardBreak') {
      return '\n';
    }
    return '';
  }

  return adf.content
    .map((block: any) => {
      const text = processNode(block);
      if (block.type === 'paragraph' || block.type === 'heading') {
        return text + '\n';
      }
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return block.content
          .map((item: any, i: number) => {
            const prefix = block.type === 'orderedList' ? `${i + 1}. ` : '- ';
            return prefix + processNode(item);
          })
          .join('\n') + '\n';
      }
      if (block.type === 'codeBlock') {
        return '```\n' + text + '\n```\n';
      }
      return text;
    })
    .join('')
    .trim();
}

// ===== 에러 생성 =====

export function createError(code: string, message: string, details?: string): JiraError {
  return {
    success: false,
    error: { code: code as any, message, details },
  };
}

// ===== JSON 출력 =====

export function outputJson(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputError(error: JiraError): void {
  console.log(JSON.stringify(error, null, 2));
  process.exit(1);
}
