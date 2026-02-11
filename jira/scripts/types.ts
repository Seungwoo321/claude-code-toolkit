/**
 * Jira 스킬 공통 타입 정의
 */

// ===== Config 타입 =====

export interface JiraConfig {
  auth?: {
    email: string;
    apiToken: string;
  };
  jira: {
    site: string;
    project: string;
    fields?: {
      default?: string[];
      list?: string[];
    };
    statusMapping: Record<string, string[]>;
    statusTransitions?: Record<string, string>;
  };
  branch: {
    patterns: string[];
    ticketRegex: string;
    recommended: string;
  };
  team: {
    members: TeamMember[];
  };
  defaults?: {
    listLimit?: number;
    includeSubtasks?: boolean;
    includeComments?: number;
  };
  list?: {
    excludeStatuses?: string[];
    includeStatuses?: string[];
  };
}

export interface TeamMember {
  name: string;
  aliases?: string[];
  github?: string;
  jira?: string;
  accountId: string;
}

// ===== Jira API 응답 타입 =====

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: any; // Atlassian Document Format
  created: string;
  updated: string;
}

export interface JiraIssueFields {
  summary: string;
  description?: any; // Atlassian Document Format
  status: JiraStatus;
  assignee: JiraUser | null;
  reporter: JiraUser | null;
  issuetype: JiraIssueType;
  priority?: { id: string; name: string };
  parent?: { key: string; fields: { summary: string } };
  subtasks?: Array<{ key: string; fields: { summary: string; status: JiraStatus } }>;
  created: string;
  updated: string;
  labels?: string[];
  components?: Array<{ id: string; name: string }>;
  comment?: { comments: JiraComment[]; total: number };
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
  nextPageToken?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[];
}

// ===== 스크립트 출력 타입 =====

export interface ParsedBranch {
  branch: string;
  ticket: string | null;
  type: string | null;
  description: string | null;
  error?: string;
}

export interface IssueOutput {
  key: string;
  summary: string;
  description: string | null;
  status: string;
  statusCategory: string;
  assignee: { name: string; accountId: string } | null;
  reporter: { name: string; accountId: string } | null;
  issuetype: string;
  priority: string | null;
  parent: { key: string; summary: string } | null;
  subtasks: Array<{ key: string; summary: string; status: string }>;
  labels: string[];
  created: string;
  updated: string;
  comments: Array<{
    id: string;
    author: string;
    body: string;
    created: string;
  }>;
  url: string;
}

export interface ListOutput {
  total: number;
  issues: Array<{
    key: string;
    summary: string;
    status: string;
    assignee: string | null;
    issuetype: string;
    updated: string;
  }>;
  query: {
    assignee?: string;
    status?: string;
    empty?: boolean;
    jql?: string;
  };
}

export interface UpdateResult {
  success: boolean;
  key: string;
  changes: Record<string, { from: string; to: string }>;
  url: string;
  error?: string;
}

export interface CommentResult {
  success: boolean;
  key: string;
  commentId?: string;
  url: string;
  error?: string;
}

// ===== 에러 타입 =====

export interface JiraError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
}

export type ErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_INVALID'
  | 'TICKET_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_TRANSITION'
  | 'ASSIGNEE_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'BRANCH_NO_TICKET'
  | 'CONFIG_ERROR'
  | 'UNKNOWN_ERROR';
