import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import linearExtension, {
  formatIssue,
  type LinearIssueLike,
  validateLinearParams,
} from "./index.ts";

interface LinearToolResultForTest {
  content: Array<{ type: string; text: string }>;
  details: {
    action?: string;
    issue: Record<string, unknown>;
    issues: Array<Record<string, unknown>>;
    attachments: Array<Record<string, unknown>>;
    comments: Array<Record<string, unknown>>;
    labels: Array<Record<string, unknown>>;
    teams: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    profile: Record<string, unknown>;
    project: Record<string, unknown>;
    label: Record<string, unknown>;
    pageInfo: Record<string, unknown>;
  };
}

interface LinearToolForTest {
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: unknown,
    context?: unknown,
    state?: Record<string, unknown>,
  ): Promise<LinearToolResultForTest>;
  renderCall(
    args: Record<string, unknown>,
    theme: TestTheme,
  ): Component & { text: string };
  renderResult(
    result: {
      content: Array<{ type: string; text: string }>;
      details: unknown;
    },
    options: { expanded: boolean; isPartial?: boolean },
    theme: TestTheme,
    context: { isError: boolean },
  ): Component;
}

interface TestTheme {
  fg(_name: string, text: string): string;
  bold(text: string): string;
}

type SessionStartHandler = (
  event: unknown,
  ctx: { ui: { notify(message: string, level: string): void } },
) => void;

function registerLinearTool(
  options: Parameters<typeof linearExtension>[1] = {},
) {
  let tool: LinearToolForTest | undefined;
  const notifications: Array<{ message: string; level: string }> = [];
  linearExtension(
    {
      on(eventName: string, handler: SessionStartHandler) {
        if (eventName === "session_start") {
          handler(
            {},
            {
              ui: {
                notify(message: string, level: string) {
                  notifications.push({ message, level });
                },
              },
            },
          );
        }
      },
      registerTool(registeredTool: unknown) {
        tool = registeredTool as LinearToolForTest;
      },
    } as ExtensionAPI,
    options,
  );
  assert.ok(tool, "linear tool should be registered");
  return { tool, notifications };
}

const theme: TestTheme = {
  fg(_name: string, text: string) {
    return text;
  },
  bold(text: string) {
    return text;
  },
};

function renderText(component: Component): string {
  if ("text" in component && typeof component.text === "string") {
    return component.text;
  }
  if (
    "children" in component &&
    Array.isArray((component as { children?: Component[] }).children)
  ) {
    return (component as { children: Component[] }).children
      .map((child) => renderText(child))
      .join("\n");
  }
  return component.render(120).join("\n");
}

describe("validateLinearParams", () => {
  it("requires issue_id for get_issue", () => {
    assert.equal(
      validateLinearParams({ action: "get_issue" }),
      "issue_id is required for get_issue",
    );
  });

  it("requires team and title when save_issue creates a new issue", () => {
    assert.equal(
      validateLinearParams({ action: "save_issue", title: "Missing team" }),
      "team is required when save_issue creates an issue",
    );
    assert.equal(
      validateLinearParams({ action: "save_issue", team: "team-1" }),
      "title is required when save_issue creates an issue",
    );
    assert.equal(
      validateLinearParams({
        action: "save_issue",
        team_id: "team-1",
        title: "Old team field",
      } as unknown as Parameters<typeof validateLinearParams>[0]),
      "team is required when save_issue creates an issue",
    );
  });

  it("requires at least one update field when save_issue updates an issue", () => {
    assert.equal(
      validateLinearParams({ action: "save_issue", issue_id: "LIN-123" }),
      "save_issue requires at least one field to update when issue_id is provided",
    );
    assert.equal(
      validateLinearParams({
        action: "save_issue",
        issue_id: "LIN-123",
        assignee_id: "user-1",
      } as unknown as Parameters<typeof validateLinearParams>[0]),
      "save_issue requires at least one field to update when issue_id is provided",
    );
  });

  it("requires issue_id for save_comment", () => {
    assert.equal(
      validateLinearParams({ action: "save_comment", body: "hello" }),
      "issue_id is required when save_comment creates a comment",
    );
  });

  it("requires priority to be an integer from 0 through 4", () => {
    assert.equal(
      validateLinearParams({
        action: "save_issue",
        team: "team-1",
        title: "Bad priority",
        priority: 4.5,
      }),
      "priority must be an integer between 0 and 4",
    );
    assert.equal(
      validateLinearParams({
        action: "save_issue",
        issue_id: "LIN-123",
        priority: 5,
      }),
      "priority must be an integer between 0 and 4",
    );
  });

  it("requires body for save_comment", () => {
    assert.equal(
      validateLinearParams({ action: "save_comment", issue_id: "LIN-123" }),
      "body is required for save_comment",
    );
  });

  it("rejects removed read_comment action", () => {
    assert.equal(
      validateLinearParams({ action: "read_comment" }),
      "Unsupported linear action: read_comment",
    );
  });

  it("accepts all supported actions with required fields", () => {
    assert.equal(
      validateLinearParams({ action: "get_issue", issue_id: "LIN-123" }),
      null,
    );
    assert.equal(
      validateLinearParams({
        action: "save_issue",
        team: "team-1",
        title: "Create me",
      }),
      null,
    );
    assert.equal(
      validateLinearParams({
        action: "save_issue",
        issue_id: "LIN-123",
        title: "Updated",
      }),
      null,
    );
    assert.equal(
      validateLinearParams({
        action: "save_comment",
        issue_id: "LIN-123",
        body: "Follow up",
      }),
      null,
    );
    assert.equal(validateLinearParams({ action: "list_issues" }), null);
    assert.equal(
      validateLinearParams({ action: "list_issues", assignee: "me" }),
      null,
    );
    assert.equal(
      validateLinearParams({ action: "list_issues", assignee: "null" }),
      null,
    );
    assert.equal(
      validateLinearParams({ action: "list_comments", issue_id: "LIN-123" }),
      null,
    );
    assert.equal(validateLinearParams({ action: "list_issue_labels" }), null);
    assert.equal(
      validateLinearParams({ action: "list_issue_labels", team: "team-1" }),
      null,
    );
    assert.equal(validateLinearParams({ action: "list_teams" }), null);
    assert.equal(validateLinearParams({ action: "get_profile" }), null);
    assert.equal(
      validateLinearParams({ action: "create_issue_label", name: "Bug" }),
      null,
    );
    assert.equal(validateLinearParams({ action: "list_projects" }), null);
    assert.equal(
      validateLinearParams({ action: "get_project", project_id: "project-1" }),
      null,
    );
  });
});

describe("formatIssue", () => {
  it("renders issue content and key metadata", () => {
    const issue: LinearIssueLike = {
      id: "uuid-1",
      identifier: "LIN-123",
      title: "Fix login redirect",
      url: "https://linear.app/acme/issue/LIN-123/fix-login-redirect",
      description: "Users should land back on the page they requested.",
      priority: 2,
      estimate: 3,
      createdAt: new Date("2026-01-02T03:04:05Z"),
      updatedAt: new Date("2026-01-03T04:05:06Z"),
      stateId: "state-1",
      teamId: "team-1",
      assigneeId: "user-1",
    };

    const text = formatIssue(issue);

    assert.match(text, /# LIN-123: Fix login redirect/);
    assert.match(text, /https:\/\/linear\.app\/acme\/issue\/LIN-123/);
    assert.match(text, /Users should land back on the page they requested\./);
    assert.match(text, /Priority: 2/);
    assert.match(text, /Estimate: 3/);
    assert.match(text, /State ID: state-1/);
    assert.match(text, /Team ID: team-1/);
    assert.match(text, /Assignee ID: user-1/);
  });
});

describe("linear extension", () => {
  it("warns when LINEAR_API_KEY is missing", () => {
    const previous = process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_API_KEY;

    try {
      const { notifications } = registerLinearTool();
      assert.deepEqual(notifications, [
        {
          message: "linear: LINEAR_API_KEY is not set — linear tool will fail.",
          level: "warning",
        },
      ]);
    } finally {
      if (previous === undefined) delete process.env.LINEAR_API_KEY;
      else process.env.LINEAR_API_KEY = previous;
    }
  });

  it("gets an issue through an injected Linear client", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async issue(id: string) {
            assert.equal(id, "LIN-123");
            return {
              id: "uuid-1",
              identifier: "LIN-123",
              title: "Fix login redirect",
              url: "https://linear.app/acme/issue/LIN-123/fix-login-redirect",
              description: "Return users to their requested page.",
              priority: 2,
              createdAt: new Date("2026-01-02T03:04:05Z"),
              updatedAt: new Date("2026-01-03T04:05:06Z"),
              stateId: "state-1",
              teamId: "team-1",
              branchName: "james/oa-6-copy-link",
              async attachments(variables?: Record<string, unknown>) {
                assert.deepEqual(variables, { first: 50 });
                return {
                  nodes: [
                    {
                      id: "attachment-1",
                      title: "Design spec",
                      url: "https://example.com/spec",
                    },
                  ],
                };
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "get_issue", issue_id: "LIN-123" },
      undefined,
      undefined,
      {},
    );

    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");
    assert.match(result.content[0].text, /# LIN-123: Fix login redirect/);
    assert.match(
      result.content[0].text,
      /Return users to their requested page\./,
    );
    assert.match(result.content[0].text, /Git branch: james\/oa-6-copy-link/);
    assert.match(result.content[0].text, /Design spec/);
    assert.equal(result.details.action, "get_issue");
    assert.equal(result.details.issue.id, "uuid-1");
    assert.equal(result.details.attachments[0].id, "attachment-1");
  });

  it("renders a compact get_issue call", () => {
    const { tool } = registerLinearTool();

    const rendered = tool.renderCall(
      { action: "get_issue", issue_id: "LIN-123" },
      theme,
    );

    assert.match(rendered.text, /linear get_issue/);
    assert.match(rendered.text, /LIN-123/);
  });

  it("save_issue creates an issue when issue_id is omitted", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async createIssue(input: Record<string, unknown>) {
            assert.deepEqual(input, {
              teamId: "team-1",
              title: "New issue",
              description: "Build the thing",
              priority: 2,
              labelIds: ["label-1"],
              assigneeId: "user-1",
            });
            return {
              issue: {
                id: "uuid-2",
                identifier: "LIN-124",
                title: "New issue",
                url: "https://linear.app/acme/issue/LIN-124/new-issue",
                description: "Build the thing",
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "save_issue",
        team: "team-1",
        title: "New issue",
        description: "Build the thing",
        priority: 2,
        label_ids: ["label-1"],
        assignee: "user-1",
      },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# LIN-124: New issue/);
    assert.equal(result.details.action, "save_issue");
    assert.equal(result.details.issue.identifier, "LIN-124");
  });

  it("save_issue resolves assignee email through Linear users", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async users(variables: Record<string, unknown>) {
            assert.deepEqual(variables, {
              first: 10,
              filter: {
                or: [
                  { email: { eq: "alice@example.com" } },
                  { name: { eq: "alice@example.com" } },
                  { displayName: { eq: "alice@example.com" } },
                ],
              },
            });
            return {
              nodes: [{ id: "alice-1", email: "alice@example.com" }],
            };
          },
          async createIssue(input: Record<string, unknown>) {
            assert.equal(input.assigneeId, "alice-1");
            return {
              issue: { id: "uuid-4", identifier: "LIN-126", title: "Assigned" },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "save_issue",
        team: "team-1",
        title: "Assigned",
        assignee: "alice@example.com",
      },
      undefined,
      undefined,
      {},
    );

    assert.equal(result.details.issue.identifier, "LIN-126");
  });

  it("save_issue resolves assignee me through the Linear viewer", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          viewer: Promise.resolve({ id: "viewer-1" }),
          async createIssue(input: Record<string, unknown>) {
            assert.equal(input.assigneeId, "viewer-1");
            return {
              issue: { id: "uuid-3", identifier: "LIN-125", title: "Assigned" },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "save_issue",
        team: "team-1",
        title: "Assigned",
        assignee: "me",
      },
      undefined,
      undefined,
      {},
    );

    assert.equal(result.details.issue.identifier, "LIN-125");
  });

  it("save_issue updates an issue when issue_id is provided", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async updateIssue(id: string, input: Record<string, unknown>) {
            assert.equal(id, "LIN-123");
            assert.deepEqual(input, {
              title: "Updated title",
              stateId: "state-2",
              addedLabelIds: ["label-2"],
            });
            return {
              issue: {
                id: "uuid-1",
                identifier: "LIN-123",
                title: "Updated title",
                url: "https://linear.app/acme/issue/LIN-123/updated-title",
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "save_issue",
        issue_id: "LIN-123",
        title: "Updated title",
        state_id: "state-2",
        added_label_ids: ["label-2"],
      },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# LIN-123: Updated title/);
    assert.equal(result.details.action, "save_issue");
  });

  it("save_comment creates a comment on an issue", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async createComment(input: Record<string, unknown>) {
            assert.deepEqual(input, {
              issueId: "LIN-123",
              body: "Follow up comment",
              parentId: "parent-1",
            });
            return {
              comment: {
                id: "comment-1",
                issueId: "uuid-1",
                body: "Follow up comment",
                url: "https://linear.app/acme/issue/LIN-123#comment-1",
                createdAt: new Date("2026-01-04T05:06:07Z"),
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "save_comment",
        issue_id: "LIN-123",
        body: "Follow up comment",
        parent_id: "parent-1",
      },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Comment comment-1/);
    assert.match(result.content[0].text, /Follow up comment/);
    assert.equal(result.details.action, "save_comment");
  });

  it("save_comment creates a comment using issueId alias", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async createComment(input: Record<string, unknown>) {
            assert.deepEqual(input, {
              issueId: "LIN-123",
              body: "Alias create",
            });
            return {
              comment: {
                id: "comment-2",
                issueId: "uuid-1",
                body: "Alias create",
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "save_comment", issueId: "LIN-123", body: "Alias create" },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /Alias create/);
  });

  it("save_comment updates a comment when id alias is provided", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async updateComment(id: string, input: Record<string, unknown>) {
            assert.equal(id, "comment-1");
            assert.deepEqual(input, { body: "Updated by id" });
            return {
              comment: {
                id: "comment-1",
                issueId: "uuid-1",
                body: "Updated by id",
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "save_comment", id: "comment-1", body: "Updated by id" },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /Updated by id/);
  });

  it("save_comment updates a comment when comment_id is provided", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async updateComment(id: string, input: Record<string, unknown>) {
            assert.equal(id, "comment-1");
            assert.deepEqual(input, { body: "Updated comment" });
            return {
              comment: {
                id: "comment-1",
                issueId: "uuid-1",
                body: "Updated comment",
                url: "https://linear.app/acme/issue/LIN-123#comment-1",
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "save_comment",
        comment_id: "comment-1",
        body: "Updated comment",
      },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /Updated comment/);
    assert.equal(result.details.action, "save_comment");
  });

  it("list_issues lists workspace issues and maps assignee filters", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          viewer: Promise.resolve({ id: "viewer-1" }),
          async issues(variables: Record<string, unknown>) {
            assert.deepEqual(variables, {
              first: 2,
              filter: { assignee: { id: { eq: "viewer-1" } } },
            });
            return {
              nodes: [
                { id: "uuid-1", identifier: "LIN-123", title: "First issue" },
                { id: "uuid-2", identifier: "LIN-124", title: "Second issue" },
              ],
              pageInfo: { hasNextPage: false, endCursor: "cursor-2" },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "list_issues", assignee: "me", first: 2 },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Linear issues/);
    assert.match(result.content[0].text, /LIN-123: First issue/);
    assert.equal(result.details.action, "list_issues");
    assert.equal(result.details.issues.length, 2);
  });

  it("list_issues maps assignee null to unassigned issues", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async issues(variables: Record<string, unknown>) {
            assert.deepEqual(variables, {
              first: 20,
              filter: { assignee: { null: true } },
            });
            return { nodes: [], pageInfo: { hasNextPage: false } };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "list_issues", assignee: "null" },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /No issues found/);
  });

  it("get_profile retrieves the authenticated Linear user", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          viewer: {
            id: "user-1",
            name: "Jane Doe",
            displayName: "Jane",
            email: "jane@example.com",
            url: "https://linear.app/acme/profiles/jane",
            avatarUrl: "https://example.com/avatar.png",
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "get_profile" },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Jane Doe/);
    assert.match(result.content[0].text, /jane@example.com/);
    assert.equal(result.details.action, "get_profile");
    assert.equal(result.details.profile.id, "user-1");
  });

  it("requires name for create_issue_label", () => {
    assert.equal(
      validateLinearParams({ action: "create_issue_label" }),
      "name is required for create_issue_label",
    );
  });

  it("requires project_id for get_project", () => {
    assert.equal(
      validateLinearParams({ action: "get_project" }),
      "project_id is required for get_project",
    );
  });

  it("list_projects lists workspace projects", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async projects(variables: Record<string, unknown>) {
            assert.deepEqual(variables, { first: 2 });
            return {
              nodes: [
                {
                  id: "project-1",
                  name: "Alpha",
                  url: "https://linear.app/p/alpha",
                },
                {
                  id: "project-2",
                  name: "Beta",
                  url: "https://linear.app/p/beta",
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: "cursor-2" },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "list_projects", first: 2 },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Linear projects/);
    assert.match(result.content[0].text, /Alpha/);
    assert.equal(result.details.action, "list_projects");
    assert.equal(result.details.projects.length, 2);
  });

  it("get_project retrieves project details", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async project(id: string) {
            assert.equal(id, "project-1");
            return {
              id: "project-1",
              name: "Alpha",
              url: "https://linear.app/p/alpha",
              description: "Important project",
              state: "started",
              createdAt: new Date("2026-01-01T00:00:00Z"),
              updatedAt: new Date("2026-01-02T00:00:00Z"),
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "get_project", project_id: "project-1" },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Alpha/);
    assert.match(result.content[0].text, /Important project/);
    assert.equal(result.details.action, "get_project");
    assert.equal(result.details.project.id, "project-1");
  });

  it("create_issue_label creates a Linear issue label", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async createIssueLabel(input: Record<string, unknown>) {
            assert.deepEqual(input, {
              name: "Customer bug",
              color: "#ff0000",
              description: "Reported by customers",
              parentId: "parent-label-1",
              teamId: "team-1",
            });
            return {
              issueLabel: {
                id: "label-1",
                name: "Customer bug",
                color: "#ff0000",
                description: "Reported by customers",
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "create_issue_label",
        name: "Customer bug",
        color: "#ff0000",
        description: "Reported by customers",
        parent_id: "parent-label-1",
        team: "team-1",
      },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /Customer bug/);
    assert.equal(result.details.action, "create_issue_label");
    assert.equal(result.details.label.id, "label-1");
  });

  it("list_teams lists available Linear teams", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async teams(variables: Record<string, unknown>) {
            assert.deepEqual(variables, { first: 2 });
            return {
              nodes: [
                { id: "team-1", key: "OA", name: "Operations" },
                { id: "team-2", key: "ENG", name: "Engineering" },
              ],
              pageInfo: { hasNextPage: false, endCursor: "cursor-2" },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "list_teams", first: 2 },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Linear teams/);
    assert.match(result.content[0].text, /OA: Operations/);
    assert.equal(result.details.action, "list_teams");
    assert.equal(result.details.teams.length, 2);
  });

  it("list_issue_labels lists workspace issue labels", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async issueLabels(variables: Record<string, unknown>) {
            assert.deepEqual(variables, { first: 2 });
            return {
              nodes: [
                { id: "label-1", name: "Bug", color: "#ff0000" },
                { id: "label-2", name: "Feature", color: "#00ff00" },
              ],
              pageInfo: { hasNextPage: false, endCursor: "cursor-2" },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "list_issue_labels", first: 2 },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Linear issue labels/);
    assert.match(result.content[0].text, /Bug/);
    assert.equal(result.details.action, "list_issue_labels");
    assert.equal(result.details.labels.length, 2);
  });

  it("list_issue_labels lists team issue labels when team is provided", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async team(id: string) {
            assert.equal(id, "team-1");
            return {
              async labels(variables: Record<string, unknown>) {
                assert.deepEqual(variables, { first: 20 });
                return {
                  nodes: [{ id: "label-3", name: "Team label" }],
                  pageInfo: { hasNextPage: false },
                };
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      { action: "list_issue_labels", team: "team-1" },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /Team label/);
    assert.equal(result.details.labels[0].id, "label-3");
  });

  it("list_comments lists comments for an issue", async () => {
    const { tool } = registerLinearTool({
      createClient() {
        return {
          async issue(id: string) {
            assert.equal(id, "LIN-123");
            return {
              id: "uuid-1",
              identifier: "LIN-123",
              title: "Issue with comments",
              async comments(variables?: Record<string, unknown>) {
                assert.deepEqual(variables, {
                  first: 2,
                  includeArchived: true,
                });
                return {
                  nodes: [
                    {
                      id: "comment-1",
                      issueId: "uuid-1",
                      body: "First comment",
                      createdAt: new Date("2026-01-04T05:06:07Z"),
                    },
                    {
                      id: "comment-2",
                      issueId: "uuid-1",
                      body: "Second comment",
                      createdAt: new Date("2026-01-05T05:06:07Z"),
                    },
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: "cursor-2",
                    request: () => undefined,
                  },
                };
              },
            };
          },
        };
      },
    });

    const result = await tool.execute(
      "call-1",
      {
        action: "list_comments",
        issue_id: "LIN-123",
        first: 2,
        include_archived: true,
      },
      undefined,
      undefined,
      {},
    );

    assert.match(result.content[0].text, /# Comments for LIN-123/);
    assert.match(result.content[0].text, /First comment/);
    assert.match(result.content[0].text, /Second comment/);
    assert.equal(result.details.action, "list_comments");
    assert.equal(result.details.comments.length, 2);
    assert.deepEqual(result.details.pageInfo, {
      hasNextPage: false,
      endCursor: "cursor-2",
    });
    assert.doesNotThrow(() => structuredClone(result.details));
  });

  it("renders get_issue results collapsed by default and expanded on demand", () => {
    const { tool } = registerLinearTool();
    const result = {
      content: [
        {
          type: "text",
          text: "# LIN-123: Fix login redirect\n\nhttps://linear.app/acme/issue/LIN-123/fix-login-redirect\n\n## Metadata\n- ID: uuid-1\n\n## Description\nReturn users to their requested page.",
        },
      ],
      details: {
        action: "get_issue",
        issue: {
          id: "uuid-1",
          identifier: "LIN-123",
          title: "Fix login redirect",
          url: "https://linear.app/acme/issue/LIN-123/fix-login-redirect",
        },
      },
    };

    const collapsed = renderText(
      tool.renderResult(result, { expanded: false, isPartial: false }, theme, {
        isError: false,
      }),
    );
    assert.match(collapsed, /✓ linear LIN-123/);
    assert.match(collapsed, /Fix login redirect/);
    assert.match(collapsed, /to expand/);
    assert.doesNotMatch(collapsed, /Return users to their requested page/);
    assert.doesNotMatch(collapsed, /## Description/);

    const expanded = renderText(
      tool.renderResult(result, { expanded: true, isPartial: false }, theme, {
        isError: false,
      }),
    );
    assert.match(expanded, /✓ linear LIN-123/);
    assert.match(expanded, /Return users to their requested page/);
    assert.match(expanded, /Metadata/);
    assert.doesNotMatch(expanded, /to expand/);
  });
});
