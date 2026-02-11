#!/usr/bin/env npx tsx
/**
 * Jira 티켓 목록 조회
 *
 * 사용법:
 *   npx tsx list-issues.ts --mine                     # 내 담당 티켓 (하위 태스크 포함)
 *   npx tsx list-issues.ts --assignee "이승우"        # 특정 담당자 (하위 태스크 포함)
 *   npx tsx list-issues.ts --empty                    # 설명 없는 티켓
 *   npx tsx list-issues.ts --status "In Progress"    # 상태별
 *   npx tsx list-issues.ts --type Story              # 타입별
 *   npx tsx list-issues.ts --jql "custom JQL"        # 커스텀 JQL
 *   npx tsx list-issues.ts --limit 10                # 결과 제한
 *   npx tsx list-issues.ts --all                     # 완료 포함 모든 티켓
 *   npx tsx list-issues.ts --sprint current          # 현재 스프린트
 *   npx tsx list-issues.ts --sprint next             # 예정 스프린트
 *   npx tsx list-issues.ts --sprint "Sprint 8"       # 특정 스프린트
 *   npx tsx list-issues.ts --backlog                 # 백로그 (스프린트 미할당)
 *   npx tsx list-issues.ts --json                    # JSON 형식 출력
 *
 * 출력:
 *   기본: 트리 형식
 *   --json: JSON 형식
 *
 * 참고:
 *   - --mine/--assignee와 --sprint를 함께 사용할 때,
 *     상위 티켓이 해당 스프린트에 있는 하위 태스크도 포함됩니다.
 */

import {
  loadConfig,
  getAuth,
  searchIssues,
  findTeamMember,
  getTeamMemberName,
  normalizeStatus,
  createError,
  outputJson,
  outputError,
} from './jira-api.js';
import type { ListOutput, JiraError } from './types.js';

interface ListArgs {
  mine: boolean;
  assignee: string | null;
  status: string | null;
  type: string | null;
  empty: boolean;
  jql: string | null;
  limit: number;
  all: boolean;
  sprint: string | null;
  backlog: boolean;
  json: boolean;
}

function parseArgs(): ListArgs {
  const args = process.argv.slice(2);
  const result: ListArgs = {
    mine: false,
    assignee: null,
    status: null,
    type: null,
    empty: false,
    jql: null,
    limit: 30,
    all: false,
    sprint: null,
    backlog: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mine':
        result.mine = true;
        break;
      case '--assignee':
        result.assignee = args[++i];
        break;
      case '--status':
        result.status = args[++i];
        break;
      case '--type':
        result.type = args[++i];
        break;
      case '--empty':
        result.empty = true;
        break;
      case '--jql':
        result.jql = args[++i];
        break;
      case '--limit':
        result.limit = parseInt(args[++i], 10) || 30;
        break;
      case '--all':
        result.all = true;
        break;
      case '--sprint':
        result.sprint = args[++i];
        break;
      case '--backlog':
        result.backlog = true;
        break;
      case '--json':
        result.json = true;
        break;
      // 하위 호환성: --subtasks는 무시 (기본으로 포함됨)
      case '--subtasks':
        break;
    }
  }

  return result;
}

// 상태 아이콘 반환
function getStatusIcon(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('done') || statusLower.includes('완료')) return '✅';
  if (statusLower.includes('progress') || statusLower.includes('진행')) return '🔄';
  if (statusLower.includes('review') || statusLower.includes('리뷰')) return '👀';
  if (statusLower.includes('drop')) return '❌';
  return '⬜';
}

// 상태 짧은 이름 반환
function getStatusShort(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('done') || statusLower.includes('완료')) return '완료';
  if (statusLower.includes('progress') || statusLower.includes('진행')) return '진행중';
  if (statusLower.includes('review') || statusLower.includes('리뷰')) return '리뷰';
  if (statusLower.includes('drop')) return 'DROP';
  if (statusLower.includes('to do') || statusLower.includes('할 일')) return '할일';
  return status;
}

interface IssueData {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  issuetype: string;
  updated: string;
  sprint: string | null;
  parent?: {
    key: string;
    summary: string;
  };
  subtasks?: Array<{
    key: string;
    summary: string;
    status: string;
  }>;
}

// 상태별로 이슈 그룹화
function groupByStatus(issues: IssueData[]): Map<string, IssueData[]> {
  const groups = new Map<string, IssueData[]>();
  groups.set('inProgress', []);
  groups.set('review', []);
  groups.set('todo', []);
  groups.set('done', []);
  groups.set('other', []);

  for (const issue of issues) {
    const statusLower = issue.status.toLowerCase();
    if (statusLower.includes('progress') || statusLower.includes('진행')) {
      groups.get('inProgress')!.push(issue);
    } else if (statusLower.includes('review') || statusLower.includes('리뷰')) {
      groups.get('review')!.push(issue);
    } else if (statusLower.includes('to do') || statusLower.includes('할 일')) {
      groups.get('todo')!.push(issue);
    } else if (statusLower.includes('done') || statusLower.includes('완료')) {
      groups.get('done')!.push(issue);
    } else {
      groups.get('other')!.push(issue);
    }
  }

  return groups;
}

// 이슈 그룹 출력 (상태별)
function printStatusGroup(title: string, items: IssueData[], baseUrl: string, indent: string = ''): void {
  if (items.length === 0) return;

  console.log(`${indent}${title} (${items.length}건)`);

  items.forEach((issue, index) => {
    const isLast = index === items.length - 1;
    const prefix = isLast ? '└─' : '├─';
    const childPrefix = isLast ? '   ' : '│  ';

    // 담당자 표시
    const assigneeStr = issue.assignee && issue.assignee !== 'Unknown'
      ? ` 👤 ${issue.assignee}`
      : '';

    // 상위 티켓 표시 (하위 태스크인 경우)
    const parentStr = issue.parent
      ? ` ← ${issue.parent.key}`
      : '';

    // 요약 (너무 길면 자르기)
    const summaryMax = 45;
    const summary = issue.summary.length > summaryMax
      ? issue.summary.substring(0, summaryMax) + '...'
      : issue.summary;

    // 링크
    const link = `${baseUrl}/browse/${issue.key}`;

    console.log(`${indent}${prefix} ${issue.key}: ${summary}${assigneeStr}${parentStr}`);
    console.log(`${indent}${childPrefix}  🔗 ${link}`);

    // 하위 태스크 출력
    if (issue.subtasks && issue.subtasks.length > 0) {
      issue.subtasks.forEach((sub, subIndex) => {
        const isSubLast = subIndex === issue.subtasks!.length - 1;
        const subPrefix = isSubLast ? '└─' : '├─';
        const icon = getStatusIcon(sub.status);
        const statusShort = getStatusShort(sub.status);

        // 하위 태스크 요약 (더 짧게)
        const subSummaryMax = 40;
        const subSummary = sub.summary.length > subSummaryMax
          ? sub.summary.substring(0, subSummaryMax) + '...'
          : sub.summary;

        console.log(`${indent}${childPrefix}${subPrefix} ${icon} ${sub.key}: ${subSummary} (${statusShort})`);
      });
    }
  });

  console.log('');
}

// 트리 형식 출력 (스프린트별 그룹화 지원)
function outputTree(issues: IssueData[], total: number, baseUrl: string): void {
  // 스프린트별로 그룹화
  const sprintGroups = new Map<string, IssueData[]>();

  for (const issue of issues) {
    const sprintName = issue.sprint || '📦 백로그';
    if (!sprintGroups.has(sprintName)) {
      sprintGroups.set(sprintName, []);
    }
    sprintGroups.get(sprintName)!.push(issue);
  }

  console.log(`\n📋 티켓 목록 (${total}건)\n`);

  // 스프린트가 1개인 경우 스프린트 헤더 없이 출력
  if (sprintGroups.size === 1) {
    const [, sprintIssues] = [...sprintGroups.entries()][0];
    const statusGroups = groupByStatus(sprintIssues);

    printStatusGroup('🔄 진행중', statusGroups.get('inProgress')!, baseUrl);
    printStatusGroup('👀 리뷰', statusGroups.get('review')!, baseUrl);
    printStatusGroup('⬜ 해야 할 일', statusGroups.get('todo')!, baseUrl);
    printStatusGroup('✅ 완료', statusGroups.get('done')!, baseUrl);
    printStatusGroup('📌 기타', statusGroups.get('other')!, baseUrl);
  } else {
    // 스프린트가 여러 개인 경우 스프린트별로 구분
    // 스프린트 이름 정렬 (백로그는 마지막)
    const sortedSprints = [...sprintGroups.keys()].sort((a, b) => {
      if (a === '📦 백로그') return 1;
      if (b === '📦 백로그') return -1;
      return a.localeCompare(b);
    });

    for (const sprintName of sortedSprints) {
      const sprintIssues = sprintGroups.get(sprintName)!;
      const statusGroups = groupByStatus(sprintIssues);

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🏃 ${sprintName} (${sprintIssues.length}건)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      printStatusGroup('🔄 진행중', statusGroups.get('inProgress')!, baseUrl, '  ');
      printStatusGroup('👀 리뷰', statusGroups.get('review')!, baseUrl, '  ');
      printStatusGroup('⬜ 해야 할 일', statusGroups.get('todo')!, baseUrl, '  ');
      printStatusGroup('✅ 완료', statusGroups.get('done')!, baseUrl, '  ');
      printStatusGroup('📌 기타', statusGroups.get('other')!, baseUrl, '  ');
    }
  }

  console.log('범례: ✅ 완료 | 🔄 진행중 | ⬜ 할일 | 👀 리뷰 | ❌ DROP | 👤 담당자 | ← 상위티켓\n');
}

async function main() {
  try {
    const args = parseArgs();
    const config = loadConfig();
    const auth = getAuth();
    const baseUrl = config.jira.site;
    const project = config.jira.project;

    // config.list에서 상태 필터링 설정 가져오기
    const excludeStatuses = config.list?.excludeStatuses || [];
    const includeStatuses = config.list?.includeStatuses || [];

    // --all 옵션이 있으면 필터링 비활성화
    const skipFiltering = args.all || args.status;

    // JQL 구성
    let jql: string;
    const conditions: string[] = [`project = "${project}"`];

    if (args.jql) {
      // 커스텀 JQL 사용
      jql = args.jql;
    } else {
      // 담당자 조건
      if (args.mine) {
        conditions.push('assignee = currentUser()');
      } else if (args.assignee) {
        const member = findTeamMember(config, args.assignee);
        if (member) {
          conditions.push(`assignee = "${member.accountId}"`);
        } else {
          // 직접 이름으로 검색
          conditions.push(`assignee = "${args.assignee}"`);
        }
      }

      // 상태 조건
      if (args.status) {
        const normalizedStatus = normalizeStatus(config, args.status);
        if (normalizedStatus) {
          conditions.push(`status = "${normalizedStatus}"`);
        } else {
          conditions.push(`status = "${args.status}"`);
        }
      }

      // 상태 필터링 적용 (--all 또는 --status 옵션이 없는 경우)
      if (!skipFiltering) {
        // includeStatuses가 있으면 해당 상태만 포함
        if (includeStatuses.length > 0) {
          const includeCondition = includeStatuses.map(s => `status = "${s}"`).join(' OR ');
          conditions.push(`(${includeCondition})`);
        }
        // excludeStatuses가 있으면 해당 상태 제외
        else if (excludeStatuses.length > 0) {
          const excludeConditions = excludeStatuses.map(s => `status != "${s}"`).join(' AND ');
          conditions.push(`(${excludeConditions})`);
        }
      }

      // 타입 조건
      if (args.type) {
        conditions.push(`issuetype = "${args.type}"`);
      }

      // 빈 티켓 (설명 없음)
      if (args.empty) {
        conditions.push('description is EMPTY');
      }

      // 스프린트 조건
      if (args.backlog) {
        conditions.push('sprint is EMPTY');
      } else if (args.sprint) {
        switch (args.sprint.toLowerCase()) {
          case 'current':
          case 'active':
            conditions.push('sprint in openSprints()');
            break;
          case 'next':
          case 'future':
            conditions.push('sprint in futureSprints()');
            break;
          case 'closed':
          case 'done':
            conditions.push('sprint in closedSprints()');
            break;
          default:
            conditions.push(`sprint = "${args.sprint}"`);
            break;
        }
      }

      jql = conditions.join(' AND ') + ' ORDER BY updated DESC';
    }

    // 조회할 필드 (subtasks, sprint, parent 기본 포함)
    const fields = [
      'summary',
      'status',
      'assignee',
      'issuetype',
      'updated',
      'subtasks',
      'parent',
      'customfield_10007', // Sprint 필드 (Jira Software)
    ];

    // 검색 실행
    let issues = await searchIssues(baseUrl, auth, jql, fields, args.limit);

    // 담당자 필터 + 스프린트 필터가 함께 있으면, 하위 태스크도 별도 조회하여 병합
    const hasAssigneeFilter = args.mine || args.assignee;
    if (hasAssigneeFilter && args.sprint && !args.backlog) {
      // 하위 태스크만 조회 (스프린트 조건 없이)
      const subtaskConditions: string[] = [`project = "${project}"`];

      if (args.mine) {
        subtaskConditions.push('assignee = currentUser()');
      } else if (args.assignee) {
        const member = findTeamMember(config, args.assignee);
        if (member) {
          subtaskConditions.push(`assignee = "${member.accountId}"`);
        } else {
          subtaskConditions.push(`assignee = "${args.assignee}"`);
        }
      }

      subtaskConditions.push('issuetype = "하위 작업"');

      // 상태 필터링 적용
      if (!skipFiltering) {
        if (includeStatuses.length > 0) {
          const includeCondition = includeStatuses.map(s => `status = "${s}"`).join(' OR ');
          subtaskConditions.push(`(${includeCondition})`);
        } else if (excludeStatuses.length > 0) {
          const excludeConditions = excludeStatuses.map(s => `status != "${s}"`).join(' AND ');
          subtaskConditions.push(`(${excludeConditions})`);
        }
      }

      const subtaskJql = subtaskConditions.join(' AND ') + ' ORDER BY updated DESC';
      const subtasks = await searchIssues(baseUrl, auth, subtaskJql, fields, args.limit);

      // 기존 결과에 하위 태스크 병합 (중복 제거)
      const existingKeys = new Set(issues.map(i => i.key));
      for (const subtask of subtasks) {
        if (!existingKeys.has(subtask.key)) {
          issues.push(subtask);
          existingKeys.add(subtask.key);
        }
      }
    }

    // 스프린트 이름 추출 헬퍼
    const getSprintName = (sprints: any[] | null): string | null => {
      if (!sprints || sprints.length === 0) return null;
      // 가장 최근 (또는 활성) 스프린트 이름 반환
      // 활성 스프린트 우선, 없으면 마지막 스프린트
      const activeSprint = sprints.find((s) => s.state === 'active');
      if (activeSprint) return activeSprint.name;
      return sprints[sprints.length - 1]?.name || null;
    };

    // 데이터 변환
    let issueDataList: IssueData[] = issues.map((issue) => {
      const issueData: IssueData = {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee
          ? getTeamMemberName(config, issue.fields.assignee.accountId)
          : null,
        issuetype: issue.fields.issuetype.name,
        updated: issue.fields.updated,
        sprint: getSprintName(issue.fields.customfield_10007),
      };

      // parent가 있으면 포함 (하위 태스크인 경우)
      if (issue.fields.parent) {
        issueData.parent = {
          key: issue.fields.parent.key,
          summary: issue.fields.parent.fields?.summary || '',
        };
      }

      // subtasks가 있으면 포함
      if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
        issueData.subtasks = issue.fields.subtasks.map((sub: any) => ({
          key: sub.key,
          summary: sub.fields.summary,
          status: sub.fields.status.name,
        }));
      }

      return issueData;
    });

    // 스프린트 필터가 있고 담당자 필터도 있는 경우,
    // 하위 태스크의 상위 티켓 스프린트 정보를 조회하여 필터링
    if (args.sprint && (args.mine || args.assignee)) {
      // 하위 태스크들의 상위 티켓 키 수집
      const subtasksWithParent = issueDataList.filter(
        (issue) => issue.issuetype === '하위 작업' && issue.parent
      );
      const parentKeys = [...new Set(subtasksWithParent.map((s) => s.parent!.key))];

      // 상위 티켓들의 스프린트 정보 조회
      const parentSprintMap = new Map<string, string | null>();

      if (parentKeys.length > 0) {
        const parentJql = `key in (${parentKeys.map((k) => `"${k}"`).join(',')})`;
        try {
          const parentIssues = await searchIssues(baseUrl, auth, parentJql, ['customfield_10007'], parentKeys.length);

          for (const parent of parentIssues) {
            const sprint = parent.fields?.customfield_10007;
            parentSprintMap.set(parent.key, getSprintName(sprint));
          }
        } catch (e) {
          // 상위 티켓 조회 실패 시 무시 (하위 태스크 필터링 안함)
          console.error('Warning: Failed to fetch parent sprint info');
        }
      }

      // 스프린트 조건 결정
      let targetSprintCheck: (sprint: string | null) => boolean;
      switch (args.sprint.toLowerCase()) {
        case 'current':
        case 'active':
          // 활성 스프린트에 있는지 확인 (스프린트 이름이 있으면 포함)
          targetSprintCheck = (sprint) => sprint !== null;
          break;
        default:
          // 특정 스프린트 이름과 일치하는지 확인
          targetSprintCheck = (sprint) => sprint === args.sprint;
          break;
      }

      // 하위 태스크 필터링
      issueDataList = issueDataList.filter((issue) => {
        // 하위 태스크가 아닌 경우 유지
        if (issue.issuetype !== '하위 작업') {
          return true;
        }

        // 하위 태스크 자체에 스프린트가 설정된 경우
        if (issue.sprint && targetSprintCheck(issue.sprint)) {
          return true;
        }

        // 상위 티켓의 스프린트 확인
        if (issue.parent) {
          const parentSprint = parentSprintMap.get(issue.parent.key);
          if (parentSprint && targetSprintCheck(parentSprint)) {
            // 하위 태스크에 상위의 스프린트 정보 상속
            issue.sprint = parentSprint;
            return true;
          }
        }

        return false;
      });
    }

    // 출력
    if (args.json) {
      // JSON 형식 출력
      const output: ListOutput = {
        total: issueDataList.length,
        issues: issueDataList,
        query: {
          assignee: args.mine ? 'me' : args.assignee || undefined,
          status: args.status || undefined,
          sprint: args.sprint || undefined,
          backlog: args.backlog || undefined,
          empty: args.empty || undefined,
          jql: args.jql || undefined,
        },
      };
      outputJson(output);
    } else {
      // 트리 형식 출력
      outputTree(issueDataList, issueDataList.length, baseUrl);
    }
  } catch (error) {
    if ((error as JiraError).error) {
      outputError(error as JiraError);
    } else {
      outputError(createError('UNKNOWN_ERROR', String(error)));
    }
  }
}

main();
