import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LINEAR_PROMPT_PATTERN = /^\s*Analyze\s+Linear\s+issue:\s*(\S+)/i;

export interface LinearPromptMatch {
  issueId: string;
}

export interface LinearAttachmentLike {
  id: string;
  title?: string | null;
  url?: string | null;
}

export interface LinearIssueLike {
  id: string;
  identifier?: string;
  title?: string;
  url?: string;
  description?: string | null;
  branchName?: string | null;
  attachments?: (
    variables?: Record<string, unknown>,
  ) =>
    | Promise<{ nodes: LinearAttachmentLike[] }>
    | { nodes: LinearAttachmentLike[] };
}

export function extractLinearPromptMatch(
  prompt: string,
): LinearPromptMatch | undefined {
  const match = prompt.match(LINEAR_PROMPT_PATTERN);
  const issueId = match?.[1]?.trim();
  return issueId ? { issueId } : undefined;
}

function issueLabel(issue: LinearIssueLike): string {
  return issue.identifier || issue.id;
}

function issueTitle(issue: LinearIssueLike): string {
  return issue.title?.trim() || "Untitled issue";
}

function attachmentLabel(attachment: LinearAttachmentLike): string {
  return attachment.title?.trim() || attachment.id;
}

export async function loadIssueAttachments(
  issue: LinearIssueLike,
): Promise<LinearAttachmentLike[]> {
  if (!issue.attachments) return [];
  const connection = await issue.attachments({ first: 50 });
  return connection.nodes;
}

export function formatLinearIssueContext(
  issue: LinearIssueLike,
  attachments: LinearAttachmentLike[] = [],
): string {
  const label = issueLabel(issue);
  const title = issueTitle(issue);
  const lines = [`# Linear Issue: ${label}: ${title}`];

  if (issue.url) lines.push("", issue.url);
  if (issue.branchName?.trim()) {
    lines.push("", `Git branch: ${issue.branchName.trim()}`);
  }

  lines.push(
    "",
    "## Description",
    issue.description?.trim() || "No description.",
  );

  const linkedAttachments = attachments.filter(
    (attachment) => attachment.title?.trim() || attachment.url?.trim(),
  );
  if (linkedAttachments.length > 0) {
    lines.push("", "## Attachments");
    for (const attachment of linkedAttachments) {
      const label = attachmentLabel(attachment);
      const url = attachment.url?.trim();
      lines.push(`- ${label}${url ? ` — ${url}` : ""}`);
    }
  }

  return lines.join("\n");
}

export function linearIssueSummary(
  issue: LinearIssueLike,
  attachments: LinearAttachmentLike[] = [],
): {
  label: string;
  title: string;
  url?: string;
  branchName?: string;
  attachmentCount: number;
} {
  return {
    label: issueLabel(issue),
    title: issueTitle(issue),
    url: issue.url,
    branchName: issue.branchName?.trim() || undefined,
    attachmentCount: attachments.length,
  };
}

declare const linearExtensionOptionsBrand: unique symbol;

export type LinearExtensionOptions = {
  [linearExtensionOptionsBrand]?: never;
};

export default function linearExtension(
  _pi: ExtensionAPI,
  _options: LinearExtensionOptions = {},
): void {}
