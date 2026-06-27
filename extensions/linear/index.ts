/**
 * Linear prompt widget extension.
 *
 * Requires:
 *   LINEAR_API_KEY — Linear personal API key from https://linear.app/settings/api
 */

import {
  DynamicBorder,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { LinearClient } from "@linear/sdk";

const LINEAR_PROMPT_PATTERN = /^\s*Analyze\s+Linear\s+issue:\s*(\S+)/i;
const WIDGET_ID = "linear-issue";

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

export interface LinearClientLike {
  issue?(id: string): Promise<LinearIssueLike> | LinearIssueLike;
}

export interface LinearExtensionOptions {
  createClient?: () => LinearClientLike;
}

export function extractLinearPromptMatch(
  prompt: string,
): LinearPromptMatch | undefined {
  const match = prompt.match(LINEAR_PROMPT_PATTERN);
  const issueId = match?.[1]?.trim();
  return issueId ? { issueId } : undefined;
}

function createDefaultClient(): LinearClientLike {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey)
    throw new Error("LINEAR_API_KEY environment variable is not set.");
  return new LinearClient({ apiKey }) as unknown as LinearClientLike;
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

function unknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchIssueContext(
  createClient: () => LinearClientLike,
  issueId: string,
): Promise<{ issue: LinearIssueLike; attachments: LinearAttachmentLike[] }> {
  const client = createClient();
  if (!client.issue)
    throw new Error("Linear client does not support issue lookup.");
  const issue = await client.issue(issueId);
  const attachments = await loadIssueAttachments(issue);
  return { issue, attachments };
}

function setLoadingWidget(ctx: ExtensionContext, issueId: string): void {
  if (!ctx.hasUI) return;
  ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("muted", s)));
    container.addChild(
      new Text(theme.fg("dim", `Loading Linear issue ${issueId}...`), 1, 0),
    );
    return container;
  });
}

function setErrorWidget(
  ctx: ExtensionContext,
  issueId: string,
  message: string,
): void {
  if (!ctx.hasUI) return;
  ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("error", s)));
    container.addChild(
      new Text(
        theme.fg("error", `Failed to load ${issueId}: ${message}`),
        1,
        0,
      ),
    );
    return container;
  });
}

function setIssueWidget(
  ctx: ExtensionContext,
  issue: LinearIssueLike,
  attachments: LinearAttachmentLike[],
): void {
  if (!ctx.hasUI) return;
  const summary = linearIssueSummary(issue, attachments);
  ctx.ui.setWidget(WIDGET_ID, (_tui, theme) => {
    const lines = [theme.fg("accent", `${summary.label}: ${summary.title}`)];
    if (summary.branchName) lines.push(theme.fg("muted", summary.branchName));
    if (summary.attachmentCount > 0) {
      const suffix =
        summary.attachmentCount === 1 ? "attachment" : "attachments";
      lines.push(theme.fg("muted", `${summary.attachmentCount} ${suffix}`));
    }
    if (summary.url) lines.push(theme.fg("dim", summary.url));

    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("muted", s)));
    container.addChild(new Text(lines.join("\n"), 1, 0));
    return container;
  });
}

function applySessionName(
  pi: Pick<ExtensionAPI, "getSessionName" | "setSessionName">,
  issue: LinearIssueLike,
): void {
  const label = issueLabel(issue);
  const title = issueTitle(issue);
  const desiredName = `Linear: ${label} ${title}`;
  const currentName = pi.getSessionName()?.trim();
  if (
    !currentName ||
    currentName === `Linear: ${label}` ||
    currentName === label
  ) {
    pi.setSessionName(desiredName);
  }
}

function userText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (block): block is { type: string; text: string } =>
        block?.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text)
    .join("\n");
}

function latestPromptMatch(
  ctx: ExtensionContext,
): LinearPromptMatch | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index] as
      | { type?: string; message?: { role?: string; content?: unknown } }
      | undefined;
    if (entry?.type !== "message" || entry.message?.role !== "user") continue;
    const match = extractLinearPromptMatch(userText(entry.message.content));
    if (match) return match;
  }
  return undefined;
}

export default function linearExtension(
  pi: ExtensionAPI,
  options: LinearExtensionOptions = {},
): void {
  const createClient = options.createClient ?? createDefaultClient;

  async function loadAndDisplay(ctx: ExtensionContext, issueId: string) {
    setLoadingWidget(ctx, issueId);
    try {
      const { issue, attachments } = await fetchIssueContext(
        createClient,
        issueId,
      );
      setIssueWidget(ctx, issue, attachments);
      applySessionName(pi, issue);
      return { issue, attachments };
    } catch (error) {
      const message = unknownErrorMessage(error);
      setErrorWidget(ctx, issueId, message);
      ctx.ui.notify(`linear: failed to load ${issueId}: ${message}`, "error");
      return undefined;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!process.env.LINEAR_API_KEY) {
      ctx.ui.notify(
        "linear: LINEAR_API_KEY is not set — Linear issue context will fail.",
        "warning",
      );
    }

    if (!ctx.hasUI) return;
    const match = latestPromptMatch(ctx);
    if (!match) {
      ctx.ui.setWidget(WIDGET_ID, undefined);
      return;
    }
    await loadAndDisplay(ctx, match.issueId);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const match = extractLinearPromptMatch(event.prompt);
    if (!match) return;

    const loaded = await loadAndDisplay(ctx, match.issueId);
    if (!loaded) return;

    return {
      message: {
        customType: "linear-issue-context",
        content: formatLinearIssueContext(loaded.issue, loaded.attachments),
        display: false,
        details: {
          issueId: match.issueId,
          url: loaded.issue.url,
          attachmentCount: loaded.attachments.length,
        },
      },
    };
  });
}
