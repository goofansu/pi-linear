/**
 * Linear Extension
 *
 * Registers a linear tool for interacting with Linear issues and comments
 * through the official @linear/sdk package.
 *
 * Requires:
 *   LINEAR_API_KEY — Linear personal API key from https://linear.app/settings/api
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { LinearClient } from "@linear/sdk";
import { Type } from "typebox";

const LINEAR_ACTIONS = [
  "save_issue",
  "save_comment",
  "create_issue_label",
  "get_profile",
  "get_issue",
  "get_project",
  "list_issues",
  "list_projects",
  "list_teams",
  "list_issue_labels",
  "list_comments",
] as const;
const MAX_BODY_CHARS = 12_000;

export type LinearAction = (typeof LINEAR_ACTIONS)[number];

export interface LinearToolParams {
  action: LinearAction | string;
  issue_id?: string;
  issueId?: string;
  comment_id?: string;
  id?: string;
  team?: string;
  title?: string;
  name?: string;
  color?: string;
  description?: string;
  body?: string;
  parent_id?: string;
  assignee?: string;
  state_id?: string;
  priority?: number;
  label_ids?: string[];
  added_label_ids?: string[];
  removed_label_ids?: string[];
  project_id?: string;
  first?: number;
  include_archived?: boolean;
}

export interface LinearUserLike {
  id: string;
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
  url?: string | null;
  avatarUrl?: string | null;
  createdAt?: Date | string | null;
}

export interface LinearProjectLike {
  id: string;
  name?: string | null;
  url?: string | null;
  description?: string | null;
  state?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface LinearTeamSummaryLike {
  id: string;
  key?: string | null;
  name?: string | null;
}

export interface LinearIssueLabelLike {
  id: string;
  name?: string | null;
  color?: string | null;
  description?: string | null;
}

export interface LinearAttachmentLike {
  id: string;
  title?: string | null;
  url?: string | null;
}

export interface LinearCommentLike {
  id: string;
  issueId?: string | null;
  parentId?: string | null;
  body?: string | null;
  url?: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  editedAt?: Date | string | null;
}

interface LinearCommentConnectionLike {
  nodes: LinearCommentLike[];
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string | null;
  };
}

export interface LinearIssueLike {
  id: string;
  identifier?: string;
  title?: string;
  url?: string;
  description?: string | null;
  priority?: number | null;
  estimate?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  stateId?: string | null;
  teamId?: string | null;
  assigneeId?: string | null;
  branchName?: string | null;
  attachments?: (
    variables?: Record<string, unknown>,
  ) =>
    | Promise<{ nodes: LinearAttachmentLike[] }>
    | { nodes: LinearAttachmentLike[] };
  comments?: (
    variables?: Record<string, unknown>,
  ) => Promise<LinearCommentConnectionLike> | LinearCommentConnectionLike;
}

interface LinearTeamLike {
  labels?(variables?: Record<string, unknown>):
    | Promise<{
        nodes: LinearIssueLabelLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      }>
    | {
        nodes: LinearIssueLabelLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      };
}

interface LinearIssuePayloadLike {
  issue?: Promise<LinearIssueLike> | LinearIssueLike;
}

interface LinearCommentPayloadLike {
  comment?: Promise<LinearCommentLike> | LinearCommentLike;
}

export interface LinearClientLike {
  issue?(id: string): Promise<LinearIssueLike> | LinearIssueLike;
  createIssue?(
    input: Record<string, unknown>,
  ): Promise<LinearIssuePayloadLike> | LinearIssuePayloadLike;
  updateIssue?(
    id: string,
    input: Record<string, unknown>,
  ): Promise<LinearIssuePayloadLike> | LinearIssuePayloadLike;
  createComment?(
    input: Record<string, unknown>,
  ): Promise<LinearCommentPayloadLike> | LinearCommentPayloadLike;
  updateComment?(
    id: string,
    input: Record<string, unknown>,
  ): Promise<LinearCommentPayloadLike> | LinearCommentPayloadLike;
  createIssueLabel?(input: Record<string, unknown>):
    | Promise<{
        issueLabel?: Promise<LinearIssueLabelLike> | LinearIssueLabelLike;
      }>
    | {
        issueLabel?: Promise<LinearIssueLabelLike> | LinearIssueLabelLike;
      };
  issues?(variables?: Record<string, unknown>):
    | Promise<{
        nodes: LinearIssueLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      }>
    | {
        nodes: LinearIssueLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      };
  project?(id: string): Promise<LinearProjectLike> | LinearProjectLike;
  projects?(variables?: Record<string, unknown>):
    | Promise<{
        nodes: LinearProjectLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      }>
    | {
        nodes: LinearProjectLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      };
  issueLabels?(variables?: Record<string, unknown>):
    | Promise<{
        nodes: LinearIssueLabelLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      }>
    | {
        nodes: LinearIssueLabelLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      };
  teams?(variables?: Record<string, unknown>):
    | Promise<{
        nodes: LinearTeamSummaryLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      }>
    | {
        nodes: LinearTeamSummaryLike[];
        pageInfo?: LinearCommentConnectionLike["pageInfo"];
      };
  team?(id: string): Promise<LinearTeamLike> | LinearTeamLike;
  viewer?: Promise<LinearUserLike> | LinearUserLike;
  users?(variables?: Record<string, unknown>):
    | Promise<{
        nodes: Array<{
          id: string;
          name?: string;
          displayName?: string;
          email?: string;
        }>;
      }>
    | {
        nodes: Array<{
          id: string;
          name?: string;
          displayName?: string;
          email?: string;
        }>;
      };
}

export interface LinearExtensionOptions {
  createClient?: () => LinearClientLike;
}

interface LinearToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}

function createDefaultClient(): LinearClientLike {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey)
    throw new Error("LINEAR_API_KEY environment variable is not set.");
  return new LinearClient({ apiKey }) as unknown as LinearClientLike;
}

function truncateText(text: string, maxChars = MAX_BODY_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Linear output truncated to ${maxChars} characters.]`;
}

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function addMetadataLine(lines: string[], label: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  lines.push(`- ${label}: ${String(value)}`);
}

function trim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function optionalAssign(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value === undefined || value === null || value === "") return;
  if (Array.isArray(value) && value.length === 0) return;
  target[key] = value;
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : fallback;
  return Math.max(min, Math.min(max, n));
}

function validatePriority(priority: number | undefined): string | null {
  if (priority === undefined) return null;
  if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
    return "priority must be an integer between 0 and 4";
  }
  return null;
}

function hasUpdateFields(params: LinearToolParams): boolean {
  return Boolean(
    trim(params.title) ||
      trim(params.description) ||
      trim(params.assignee) ||
      trim(params.state_id) ||
      params.priority !== undefined ||
      params.label_ids?.length ||
      params.added_label_ids?.length ||
      params.removed_label_ids?.length ||
      trim(params.project_id) ||
      trim(params.parent_id),
  );
}

export function validateLinearParams(params: LinearToolParams): string | null {
  if (!LINEAR_ACTIONS.includes(params.action as LinearAction)) {
    return `Unsupported linear action: ${params.action}`;
  }

  const action = params.action as LinearAction;

  switch (action) {
    case "save_issue": {
      if (trim(params.issue_id)) {
        if (!hasUpdateFields(params)) {
          return "save_issue requires at least one field to update when issue_id is provided";
        }
        return validatePriority(params.priority);
      }
      if (!trim(params.team)) {
        return "team is required when save_issue creates an issue";
      }
      if (!trim(params.title)) {
        return "title is required when save_issue creates an issue";
      }
      return validatePriority(params.priority);
    }
    case "save_comment":
      if (
        !trim(params.comment_id) &&
        !trim(params.id) &&
        !trim(params.issue_id) &&
        !trim(params.issueId)
      ) {
        return "issue_id is required when save_comment creates a comment";
      }
      if (!trim(params.body)) return "body is required for save_comment";
      return null;
    case "create_issue_label":
      if (!trim(params.name)) return "name is required for create_issue_label";
      return null;
    case "get_issue":
    case "list_comments":
      if (!trim(params.issue_id)) return `issue_id is required for ${action}`;
      return null;
    case "get_project":
      if (!trim(params.project_id))
        return "project_id is required for get_project";
      return null;
    case "get_profile":
    case "list_issues":
    case "list_projects":
    case "list_teams":
    case "list_issue_labels":
      return null;
  }
}

export function formatIssue(
  issue: LinearIssueLike,
  attachments: LinearAttachmentLike[] = [],
): string {
  const identifier = issue.identifier || issue.id;
  const title = issue.title || "Untitled issue";
  const lines = [`# ${identifier}: ${title}`];

  if (issue.url) lines.push("", issue.url);

  const metadata: string[] = [];
  addMetadataLine(metadata, "ID", issue.id);
  addMetadataLine(metadata, "Priority", issue.priority);
  addMetadataLine(metadata, "Estimate", issue.estimate);
  addMetadataLine(metadata, "State ID", issue.stateId);
  addMetadataLine(metadata, "Team ID", issue.teamId);
  addMetadataLine(metadata, "Assignee ID", issue.assigneeId);
  addMetadataLine(metadata, "Git branch", issue.branchName);
  addMetadataLine(metadata, "Created", formatDate(issue.createdAt));
  addMetadataLine(metadata, "Updated", formatDate(issue.updatedAt));

  if (metadata.length > 0) {
    lines.push("", "## Metadata", ...metadata);
  }

  lines.push(
    "",
    "## Description",
    truncateText(issue.description?.trim() || "No description."),
  );

  if (attachments.length > 0) {
    lines.push("", "## Attachments");
    for (const attachment of attachments) {
      const label = attachment.title || attachment.id;
      lines.push(`- ${label}${attachment.url ? ` — ${attachment.url}` : ""}`);
    }
  }

  return lines.join("\n");
}

function formatComment(comment: LinearCommentLike): string {
  const lines = [`# Comment ${comment.id}`];
  if (comment.url) lines.push("", comment.url);

  const metadata: string[] = [];
  addMetadataLine(metadata, "ID", comment.id);
  addMetadataLine(metadata, "Issue ID", comment.issueId);
  addMetadataLine(metadata, "Parent ID", comment.parentId);
  addMetadataLine(metadata, "Created", formatDate(comment.createdAt));
  addMetadataLine(metadata, "Updated", formatDate(comment.updatedAt));
  addMetadataLine(metadata, "Edited", formatDate(comment.editedAt));
  if (metadata.length > 0) lines.push("", "## Metadata", ...metadata);

  lines.push("", "## Body", truncateText(comment.body?.trim() || "No body."));
  return lines.join("\n");
}

function formatIssues(
  issues: LinearIssueLike[],
  pageInfo?: LinearCommentConnectionLike["pageInfo"],
): string {
  const lines = ["# Linear issues"];
  if (issues.length === 0) lines.push("", "No issues found.");

  issues.forEach((issue, index) => {
    const identifier = issue.identifier || issue.id;
    lines.push(
      "",
      `## ${index + 1}. ${identifier}: ${issue.title || "Untitled issue"}`,
    );
    if (issue.url) lines.push(issue.url);
    addMetadataLine(lines, "State ID", issue.stateId);
    addMetadataLine(lines, "Assignee ID", issue.assigneeId);
    addMetadataLine(lines, "Updated", formatDate(issue.updatedAt));
  });

  if (pageInfo?.hasNextPage) {
    lines.push(
      "",
      `[More issues available after cursor: ${pageInfo.endCursor ?? "unknown"}]`,
    );
  }

  return lines.join("\n");
}

function formatProfile(user: LinearUserLike): string {
  const title = user.name || user.displayName || user.email || user.id;
  const lines = [`# ${title}`];
  if (user.url) lines.push("", user.url);

  const metadata: string[] = [];
  addMetadataLine(metadata, "ID", user.id);
  addMetadataLine(metadata, "Name", user.name);
  addMetadataLine(metadata, "Display name", user.displayName);
  addMetadataLine(metadata, "Email", user.email);
  addMetadataLine(metadata, "Avatar", user.avatarUrl);
  addMetadataLine(metadata, "Created", formatDate(user.createdAt));
  if (metadata.length > 0) lines.push("", "## Profile", ...metadata);

  return lines.join("\n");
}

function formatProject(project: LinearProjectLike): string {
  const lines = [`# ${project.name || project.id}`];
  if (project.url) lines.push("", project.url);

  const metadata: string[] = [];
  addMetadataLine(metadata, "ID", project.id);
  addMetadataLine(metadata, "State", project.state);
  addMetadataLine(metadata, "Created", formatDate(project.createdAt));
  addMetadataLine(metadata, "Updated", formatDate(project.updatedAt));
  if (metadata.length > 0) lines.push("", "## Metadata", ...metadata);

  lines.push(
    "",
    "## Description",
    truncateText(project.description?.trim() || "No description."),
  );
  return lines.join("\n");
}

function formatProjects(
  projects: LinearProjectLike[],
  pageInfo?: LinearCommentConnectionLike["pageInfo"],
): string {
  const lines = ["# Linear projects"];
  if (projects.length === 0) lines.push("", "No projects found.");

  projects.forEach((project, index) => {
    lines.push("", `## ${index + 1}. ${project.name || project.id}`);
    if (project.url) lines.push(project.url);
    addMetadataLine(lines, "ID", project.id);
    addMetadataLine(lines, "State", project.state);
    addMetadataLine(lines, "Updated", formatDate(project.updatedAt));
  });

  if (pageInfo?.hasNextPage) {
    lines.push(
      "",
      `[More projects available after cursor: ${pageInfo.endCursor ?? "unknown"}]`,
    );
  }

  return lines.join("\n");
}

function formatTeams(
  teams: LinearTeamSummaryLike[],
  pageInfo?: LinearCommentConnectionLike["pageInfo"],
): string {
  const lines = ["# Linear teams"];
  if (teams.length === 0) lines.push("", "No teams found.");

  teams.forEach((team, index) => {
    const label = team.key
      ? `${team.key}: ${team.name || team.id}`
      : team.name || team.id;
    lines.push("", `## ${index + 1}. ${label}`);
    addMetadataLine(lines, "ID", team.id);
    addMetadataLine(lines, "Key", team.key);
    addMetadataLine(lines, "Name", team.name);
  });

  if (pageInfo?.hasNextPage) {
    lines.push(
      "",
      `[More teams available after cursor: ${pageInfo.endCursor ?? "unknown"}]`,
    );
  }

  return lines.join("\n");
}

function formatIssueLabels(
  labels: LinearIssueLabelLike[],
  pageInfo?: LinearCommentConnectionLike["pageInfo"],
): string {
  const lines = ["# Linear issue labels"];
  if (labels.length === 0) lines.push("", "No issue labels found.");

  labels.forEach((label, index) => {
    lines.push("", `## ${index + 1}. ${label.name || label.id}`);
    addMetadataLine(lines, "ID", label.id);
    addMetadataLine(lines, "Color", label.color);
    addMetadataLine(lines, "Description", label.description);
  });

  if (pageInfo?.hasNextPage) {
    lines.push(
      "",
      `[More labels available after cursor: ${pageInfo.endCursor ?? "unknown"}]`,
    );
  }

  return lines.join("\n");
}

function formatComments(
  issue: LinearIssueLike,
  comments: LinearCommentLike[],
  pageInfo?: LinearCommentConnectionLike["pageInfo"],
): string {
  const issueLabel = issue.identifier || issue.id;
  const lines = [`# Comments for ${issueLabel}`];
  if (issue.title) lines.push("", issue.title);
  if (comments.length === 0) lines.push("", "No comments found.");

  comments.forEach((comment, index) => {
    lines.push("", `## ${index + 1}. Comment ${comment.id}`);
    addMetadataLine(lines, "Created", formatDate(comment.createdAt));
    addMetadataLine(lines, "Updated", formatDate(comment.updatedAt));
    lines.push("", truncateText(comment.body?.trim() || "No body."));
  });

  if (pageInfo?.hasNextPage) {
    lines.push(
      "",
      `[More comments available after cursor: ${pageInfo.endCursor ?? "unknown"}]`,
    );
  }

  return lines.join("\n");
}

function issueDetails(issue: LinearIssueLike) {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    priority: issue.priority,
    estimate: issue.estimate,
    stateId: issue.stateId,
    teamId: issue.teamId,
    assigneeId: issue.assigneeId,
    branchName: issue.branchName,
    createdAt: formatDate(issue.createdAt),
    updatedAt: formatDate(issue.updatedAt),
  };
}

function attachmentDetails(attachment: LinearAttachmentLike) {
  return {
    id: attachment.id,
    title: attachment.title,
    url: attachment.url,
  };
}

function profileDetails(user: LinearUserLike) {
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    email: user.email,
    url: user.url,
    avatarUrl: user.avatarUrl,
    createdAt: formatDate(user.createdAt),
  };
}

function projectDetails(project: LinearProjectLike) {
  return {
    id: project.id,
    name: project.name,
    url: project.url,
    state: project.state,
    createdAt: formatDate(project.createdAt),
    updatedAt: formatDate(project.updatedAt),
  };
}

function issueLabelDetails(label: LinearIssueLabelLike) {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
  };
}

function teamDetails(team: LinearTeamSummaryLike) {
  return {
    id: team.id,
    key: team.key,
    name: team.name,
  };
}

function commentDetails(comment: LinearCommentLike) {
  return {
    id: comment.id,
    issueId: comment.issueId,
    parentId: comment.parentId,
    url: comment.url,
    createdAt: formatDate(comment.createdAt),
    updatedAt: formatDate(comment.updatedAt),
    editedAt: formatDate(comment.editedAt),
  };
}

function pageInfoDetails(pageInfo: LinearCommentConnectionLike["pageInfo"]) {
  if (!pageInfo) return undefined;
  return {
    hasNextPage: pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor,
  };
}

function toolResult(
  action: LinearAction,
  text: string,
  details: Record<string, unknown>,
): LinearToolResult {
  return {
    content: [{ type: "text", text }],
    details: { action, ...details },
  };
}

function issueResult(action: LinearAction, issue: LinearIssueLike) {
  return toolResult(action, formatIssue(issue), { issue: issueDetails(issue) });
}

function commentResult(action: LinearAction, comment: LinearCommentLike) {
  return toolResult(action, formatComment(comment), {
    comment: commentDetails(comment),
  });
}

async function resolveAssigneeId(
  client: LinearClientLike,
  assignee: string | undefined,
): Promise<string | undefined> {
  const value = trim(assignee);
  if (!value) return undefined;
  if (value.toLowerCase() === "me") {
    const viewer = await client.viewer;
    if (!viewer?.id) throw new Error('Could not resolve assignee "me".');
    return viewer.id;
  }

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidLike.test(value)) return value;

  if (!client.users) return value;
  const users = await client.users({
    first: 10,
    filter: {
      or: [
        { email: { eq: value } },
        { name: { eq: value } },
        { displayName: { eq: value } },
      ],
    },
  });
  const normalized = value.toLowerCase();
  const user = users.nodes.find(
    (candidate) =>
      candidate.id === value ||
      candidate.email?.toLowerCase() === normalized ||
      candidate.name?.toLowerCase() === normalized ||
      candidate.displayName?.toLowerCase() === normalized,
  );
  if (!user) throw new Error(`Could not resolve Linear assignee: ${value}`);
  return user.id;
}

async function createIssueInput(
  client: LinearClientLike,
  params: LinearToolParams,
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {
    teamId: trim(params.team),
    title: trim(params.title),
  };
  optionalAssign(input, "description", trim(params.description));
  optionalAssign(
    input,
    "assigneeId",
    await resolveAssigneeId(client, params.assignee),
  );
  optionalAssign(input, "stateId", trim(params.state_id));
  optionalAssign(input, "priority", params.priority);
  optionalAssign(input, "labelIds", params.label_ids);
  optionalAssign(input, "projectId", trim(params.project_id));
  optionalAssign(input, "parentId", trim(params.parent_id));
  return input;
}

async function updateIssueInput(
  client: LinearClientLike,
  params: LinearToolParams,
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {};
  optionalAssign(input, "title", trim(params.title));
  optionalAssign(input, "description", trim(params.description));
  optionalAssign(
    input,
    "assigneeId",
    await resolveAssigneeId(client, params.assignee),
  );
  optionalAssign(input, "stateId", trim(params.state_id));
  optionalAssign(input, "priority", params.priority);
  optionalAssign(input, "labelIds", params.label_ids);
  optionalAssign(input, "addedLabelIds", params.added_label_ids);
  optionalAssign(input, "removedLabelIds", params.removed_label_ids);
  optionalAssign(input, "projectId", trim(params.project_id));
  optionalAssign(input, "parentId", trim(params.parent_id));
  return input;
}

async function listIssuesInput(
  client: LinearClientLike,
  params: LinearToolParams,
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {
    first: clampInt(params.first, 20, 1, 100),
  };
  const assignee = trim(params.assignee);
  if (!assignee) return input;
  if (assignee.toLowerCase() === "null") {
    input.filter = { assignee: { null: true } };
    return input;
  }
  const assigneeId = await resolveAssigneeId(client, assignee);
  if (assigneeId) input.filter = { assignee: { id: { eq: assigneeId } } };
  return input;
}

async function issueAttachments(issue: LinearIssueLike) {
  if (!issue.attachments) return [];
  const connection = await issue.attachments({ first: 50 });
  return connection.nodes;
}

async function unwrapIssuePayload(payload: LinearIssuePayloadLike) {
  const issue = await payload.issue;
  if (!issue) throw new Error("Linear did not return an issue.");
  return issue;
}

async function unwrapCommentPayload(payload: LinearCommentPayloadLike) {
  const comment = await payload.comment;
  if (!comment) throw new Error("Linear did not return a comment.");
  return comment;
}

async function unwrapIssueLabelPayload(payload: {
  issueLabel?: Promise<LinearIssueLabelLike> | LinearIssueLabelLike;
}) {
  const label = await payload.issueLabel;
  if (!label) throw new Error("Linear did not return an issue label.");
  return label;
}

function textContent(result: {
  content?: Array<{ type: string; text?: string }>;
}) {
  const part = result.content?.find((item) => item.type === "text");
  return part?.text ?? "";
}

function expandHint(): string {
  try {
    return keyHint("app.tools.expand", "to expand");
  } catch {
    return "Ctrl+O to expand";
  }
}

function renderLabel(details: unknown): {
  label: string;
  title?: string;
  url?: string;
} {
  const d = details as
    | {
        issue?: {
          id?: string;
          identifier?: string;
          title?: string;
          url?: string;
        };
        comment?: { id?: string; url?: string };
        comments?: unknown[];
      }
    | undefined;
  if (d?.issue) {
    return {
      label: d.issue.identifier ?? d.issue.id ?? "issue",
      title: d.issue.title,
      url: d.issue.url,
    };
  }
  if (d?.comment) {
    return { label: d.comment.id ?? "comment", url: d.comment.url };
  }
  return { label: "result" };
}

export default function linearExtension(
  pi: ExtensionAPI,
  options: LinearExtensionOptions = {},
): void {
  const createClient = options.createClient ?? createDefaultClient;

  pi.on("session_start", (_event, ctx) => {
    if (!process.env.LINEAR_API_KEY) {
      ctx.ui.notify(
        "linear: LINEAR_API_KEY is not set — linear tool will fail.",
        "warning",
      );
    }
  });

  pi.registerTool({
    name: "linear",
    label: "Linear",
    description:
      "Interact with Linear issues, comments, labels, projects, teams, and the authenticated user's profile through the official Linear SDK.",
    promptSnippet:
      "Use linear for Linear issues, comments, labels, projects, teams, and profile lookup.",
    promptGuidelines: [
      "Use linear save_issue to create or update a Linear issue: if issue_id is provided it updates, otherwise it creates.",
      "For linear save_issue creates, pass title and team. Use assignee (not assigneeId) for assignment; it accepts a user ID, name, email, or me.",
      "Use linear get_profile to retrieve the currently authenticated Linear user's profile.",
      "Use linear get_issue when the user asks to inspect a Linear issue's title, description, attachments, git branch, URL, or metadata.",
      "Use linear get_project to retrieve detailed information about a specific Linear project by project_id.",
      "Use linear list_issues to list issues in the user's Linear workspace. For my issues, pass assignee as me. For unassigned issues, pass assignee as null.",
      "Use linear list_projects to list projects in the user's Linear workspace.",
      "Use linear list_teams to discover Linear team IDs before creating issues with save_issue.",
      "Use linear create_issue_label to create a new Linear issue label. Pass parent_id to create a nested label under an existing parent label.",
      "Use linear list_issue_labels to discover issue label IDs before setting label_ids, added_label_ids, or removed_label_ids on save_issue.",
      "Use linear list_comments when the user asks to inspect Linear issue comment content.",
      "Use linear save_comment to create or update a comment. If comment_id is provided it updates; otherwise it creates and requires issue_id and body.",
      "For linear issue references, pass issue_id as either the Linear UUID or issue identifier such as LIN-123.",
    ],
    parameters: Type.Object({
      action: StringEnum(LINEAR_ACTIONS, {
        description: "Linear action to perform.",
      }),
      issue_id: Type.Optional(
        Type.String({
          description:
            "Linear issue UUID or issue identifier, for example LIN-123. Required for get_issue, list_comments, save_comment creates, and save_issue updates.",
        }),
      ),
      issueId: Type.Optional(
        Type.String({
          description:
            "Alias for issue_id. Supported for save_comment creates.",
        }),
      ),
      comment_id: Type.Optional(
        Type.String({
          description: "Linear comment UUID. Provide for save_comment updates.",
        }),
      ),
      id: Type.Optional(
        Type.String({
          description:
            "Alias for comment_id. Supported for save_comment updates.",
        }),
      ),
      team: Type.Optional(
        Type.String({
          description:
            "Linear team UUID. Required when save_issue creates an issue.",
        }),
      ),
      title: Type.Optional(
        Type.String({
          description: "Issue title for save_issue.",
        }),
      ),
      name: Type.Optional(
        Type.String({
          description: "Issue label name for create_issue_label.",
        }),
      ),
      color: Type.Optional(
        Type.String({
          description: "Issue label color for create_issue_label.",
        }),
      ),
      description: Type.Optional(
        Type.String({ description: "Issue description in Markdown." }),
      ),
      body: Type.Optional(
        Type.String({
          description: "Comment body in Markdown. Required for save_comment.",
        }),
      ),
      parent_id: Type.Optional(
        Type.String({
          description:
            "Parent issue ID, parent comment ID, or parent issue label ID, depending on action.",
        }),
      ),
      assignee: Type.Optional(
        Type.String({
          description:
            "Assignee user ID, name, email, or me. Used by save_issue.",
        }),
      ),
      state_id: Type.Optional(
        Type.String({ description: "Workflow state UUID." }),
      ),
      priority: Type.Optional(
        Type.Number({
          description:
            "Issue priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low.",
        }),
      ),
      label_ids: Type.Optional(
        Type.Array(Type.String({ description: "Label UUID." })),
      ),
      added_label_ids: Type.Optional(
        Type.Array(
          Type.String({
            description: "Label UUID to add during save_issue update.",
          }),
        ),
      ),
      removed_label_ids: Type.Optional(
        Type.Array(
          Type.String({
            description: "Label UUID to remove during save_issue update.",
          }),
        ),
      ),
      project_id: Type.Optional(
        Type.String({
          description:
            "Project UUID. Required for get_project; optional for save_issue.",
        }),
      ),
      first: Type.Optional(
        Type.Number({
          description:
            "Maximum issues/comments to list. Defaults to 20; max 100.",
        }),
      ),
      include_archived: Type.Optional(
        Type.Boolean({
          description: "Include archived comments for list_comments.",
        }),
      ),
    }),

    async execute(_toolCallId, params): Promise<LinearToolResult> {
      const linearParams = params as LinearToolParams;
      const validationError = validateLinearParams(linearParams);
      if (validationError) throw new Error(validationError);

      const client = createClient();

      switch (linearParams.action) {
        case "save_issue": {
          const issueId = trim(linearParams.issue_id);
          if (issueId) {
            if (!client.updateIssue)
              throw new Error("Linear client does not support updateIssue.");
            const issue = await unwrapIssuePayload(
              await client.updateIssue(
                issueId,
                await updateIssueInput(client, linearParams),
              ),
            );
            return issueResult("save_issue", issue);
          }

          if (!client.createIssue)
            throw new Error("Linear client does not support createIssue.");
          const issue = await unwrapIssuePayload(
            await client.createIssue(
              await createIssueInput(client, linearParams),
            ),
          );
          return issueResult("save_issue", issue);
        }
        case "save_comment": {
          const commentId =
            trim(linearParams.comment_id) ?? trim(linearParams.id);
          const input: Record<string, unknown> = {
            body: trim(linearParams.body),
          };
          let comment: LinearCommentLike;
          if (commentId) {
            if (!client.updateComment)
              throw new Error("Linear client does not support updateComment.");
            comment = await unwrapCommentPayload(
              await client.updateComment(commentId, input),
            );
          } else {
            if (!client.createComment)
              throw new Error("Linear client does not support createComment.");
            input.issueId =
              trim(linearParams.issue_id) ?? trim(linearParams.issueId);
            optionalAssign(input, "parentId", trim(linearParams.parent_id));
            comment = await unwrapCommentPayload(
              await client.createComment(input),
            );
          }
          return commentResult("save_comment", comment);
        }
        case "get_profile": {
          const profile = await client.viewer;
          if (!profile) throw new Error("Linear did not return a profile.");
          return toolResult("get_profile", formatProfile(profile), {
            profile: profileDetails(profile),
          });
        }
        case "get_issue": {
          if (!client.issue)
            throw new Error("Linear client does not support issue.");
          const issueId = trim(linearParams.issue_id) ?? "";
          const issue = await client.issue(issueId);
          const attachments = await issueAttachments(issue);
          return toolResult("get_issue", formatIssue(issue, attachments), {
            issue: issueDetails(issue),
            attachments: attachments.map(attachmentDetails),
          });
        }
        case "create_issue_label": {
          if (!client.createIssueLabel)
            throw new Error("Linear client does not support createIssueLabel.");
          const input: Record<string, unknown> = {
            name: trim(linearParams.name),
          };
          optionalAssign(input, "color", trim(linearParams.color));
          optionalAssign(input, "description", trim(linearParams.description));
          optionalAssign(input, "parentId", trim(linearParams.parent_id));
          optionalAssign(input, "teamId", trim(linearParams.team));
          const label = await unwrapIssueLabelPayload(
            await client.createIssueLabel(input),
          );
          return toolResult("create_issue_label", formatIssueLabels([label]), {
            label: issueLabelDetails(label),
          });
        }
        case "get_project": {
          if (!client.project)
            throw new Error("Linear client does not support project.");
          const projectId = trim(linearParams.project_id) ?? "";
          const project = await client.project(projectId);
          return toolResult("get_project", formatProject(project), {
            project: projectDetails(project),
          });
        }
        case "list_issues": {
          if (!client.issues)
            throw new Error("Linear client does not support issues.");
          const connection = await client.issues(
            await listIssuesInput(client, linearParams),
          );
          return toolResult(
            "list_issues",
            formatIssues(connection.nodes, connection.pageInfo),
            {
              issues: connection.nodes.map(issueDetails),
              pageInfo: pageInfoDetails(connection.pageInfo),
            },
          );
        }
        case "list_projects": {
          if (!client.projects)
            throw new Error("Linear client does not support projects.");
          const connection = await client.projects({
            first: clampInt(linearParams.first, 20, 1, 100),
          });
          return toolResult(
            "list_projects",
            formatProjects(connection.nodes, connection.pageInfo),
            {
              projects: connection.nodes.map(projectDetails),
              pageInfo: pageInfoDetails(connection.pageInfo),
            },
          );
        }
        case "list_teams": {
          if (!client.teams)
            throw new Error("Linear client does not support teams.");
          const connection = await client.teams({
            first: clampInt(linearParams.first, 20, 1, 100),
          });
          return toolResult(
            "list_teams",
            formatTeams(connection.nodes, connection.pageInfo),
            {
              teams: connection.nodes.map(teamDetails),
              pageInfo: pageInfoDetails(connection.pageInfo),
            },
          );
        }
        case "list_issue_labels": {
          const variables: Record<string, unknown> = {
            first: clampInt(linearParams.first, 20, 1, 100),
          };
          let connection: {
            nodes: LinearIssueLabelLike[];
            pageInfo?: LinearCommentConnectionLike["pageInfo"];
          };
          const teamId = trim(linearParams.team);
          if (teamId) {
            if (!client.team)
              throw new Error("Linear client does not support team.");
            const team = await client.team(teamId);
            if (!team.labels)
              throw new Error("Linear team did not expose labels().");
            connection = await team.labels(variables);
          } else {
            if (!client.issueLabels)
              throw new Error("Linear client does not support issueLabels.");
            connection = await client.issueLabels(variables);
          }
          return toolResult(
            "list_issue_labels",
            formatIssueLabels(connection.nodes, connection.pageInfo),
            {
              labels: connection.nodes.map(issueLabelDetails),
              pageInfo: pageInfoDetails(connection.pageInfo),
            },
          );
        }
        case "list_comments": {
          if (!client.issue)
            throw new Error("Linear client does not support issue.");
          const issueId = trim(linearParams.issue_id) ?? "";
          const issue = await client.issue(issueId);
          if (!issue.comments)
            throw new Error("Linear issue did not expose comments().");
          const variables: Record<string, unknown> = {
            first: clampInt(linearParams.first, 20, 1, 100),
          };
          if (linearParams.include_archived !== undefined) {
            variables.includeArchived = linearParams.include_archived;
          }
          const connection = await issue.comments(variables);
          return toolResult(
            "list_comments",
            formatComments(issue, connection.nodes, connection.pageInfo),
            {
              issue: issueDetails(issue),
              comments: connection.nodes.map(commentDetails),
              pageInfo: pageInfoDetails(connection.pageInfo),
            },
          );
        }
        default:
          throw new Error(`Unsupported linear action: ${linearParams.action}`);
      }
    },

    renderCall(args, theme) {
      const params = args as Partial<LinearToolParams>;
      const target = params.issue_id ?? params.comment_id ?? params.title;
      const suffix = [params.action, target].filter(Boolean).join(" ");
      return new Text(
        `${theme.fg("toolTitle", theme.bold("linear "))}${theme.fg("dim", suffix)}`,
        0,
        0,
      );
    },

    renderResult(result, { expanded }, theme, context) {
      const isError =
        context.isError || (result as { isError?: boolean }).isError === true;
      const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
      const rendered = renderLabel(result.details);
      const title = rendered.title
        ? ` ${theme.fg("muted", rendered.title)}`
        : "";
      const header = `${icon} ${theme.fg("toolTitle", theme.bold("linear"))} ${theme.fg("dim", rendered.label)}${title}`;
      const output = textContent(result);

      if (!expanded) {
        const lines = [header];
        if (isError && output) {
          lines.push(theme.fg("error", output.split("\n")[0] ?? output));
        } else if (rendered.url) {
          lines.push(theme.fg("dim", rendered.url));
        }
        lines.push(theme.fg("dim", `(${expandHint()})`));
        return new Text(lines.join("\n"), 0, 0);
      }

      const container = new Container();
      container.addChild(new Text(header, 0, 0));
      if (output) {
        container.addChild(new Spacer(1));
        container.addChild(
          new Markdown(output.trim(), 0, 0, getMarkdownTheme()),
        );
      } else {
        container.addChild(new Spacer(1));
        container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
      }
      return container;
    },
  });
}
