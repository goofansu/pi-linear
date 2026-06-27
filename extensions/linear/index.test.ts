import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLinearPromptMatch,
  formatLinearIssueContext,
  type LinearIssueLike,
  linearIssueSummary,
  loadIssueAttachments,
} from "./index.ts";

describe("extractLinearPromptMatch", () => {
  it("matches the explicit analyze prompt and extracts the first token after the colon", () => {
    assert.deepEqual(
      extractLinearPromptMatch("Analyze Linear issue: LIN-123"),
      {
        issueId: "LIN-123",
      },
    );
    assert.deepEqual(
      extractLinearPromptMatch("  analyze linear issue: LIN-123 please review"),
      { issueId: "LIN-123" },
    );
  });

  it("does not match arbitrary issue ids in prose or malformed explicit prompt tokens", () => {
    assert.equal(extractLinearPromptMatch("Please inspect LIN-123"), undefined);
    assert.equal(
      extractLinearPromptMatch("Analyze GitHub issue: LIN-123"),
      undefined,
    );
    assert.equal(extractLinearPromptMatch("Analyze Linear issue"), undefined);
    assert.equal(
      extractLinearPromptMatch("Analyze Linear issue: nope"),
      undefined,
    );
    assert.equal(
      extractLinearPromptMatch("Analyze Linear issue: https://example.com"),
      undefined,
    );
  });
});

describe("Linear issue context helpers", () => {
  const issue: LinearIssueLike = {
    id: "uuid-1",
    identifier: "LIN-123",
    title: "Fix login redirect",
    url: "https://linear.app/acme/issue/LIN-123/fix-login-redirect",
    description: "Users should land back on the page they requested.",
    branchName: "james/lin-123-fix-login-redirect",
  };

  it("formats issue context with URL, title, branch, description, and attachments", () => {
    const text = formatLinearIssueContext(issue, [
      {
        id: "attachment-1",
        title: "Design spec",
        url: "https://example.com/spec",
      },
      {
        id: "attachment-2",
        title: "Pull request",
        url: "https://github.com/acme/app/pull/12",
      },
    ]);

    assert.match(text, /# Linear Issue: LIN-123: Fix login redirect/);
    assert.match(text, /https:\/\/linear\.app\/acme\/issue\/LIN-123/);
    assert.match(text, /Git branch: james\/lin-123-fix-login-redirect/);
    assert.match(text, /Users should land back on the page they requested\./);
    assert.match(text, /- Design spec — https:\/\/example\.com\/spec/);
    assert.match(
      text,
      /- Pull request — https:\/\/github\.com\/acme\/app\/pull\/12/,
    );
  });

  it("uses a missing description fallback and omits empty attachments", () => {
    const text = formatLinearIssueContext(
      { id: "uuid-2", identifier: "LIN-124" },
      [],
    );

    assert.match(text, /# Linear Issue: LIN-124/);
    assert.match(text, /No description\./);
    assert.doesNotMatch(text, /## Attachments/);
  });

  it("loads attachments through the Linear issue connection", async () => {
    const loaded = await loadIssueAttachments({
      id: "uuid-3",
      async attachments(variables?: Record<string, unknown>) {
        assert.deepEqual(variables, { first: 50 });
        return { nodes: [{ id: "attachment-1", title: "Spec" }] };
      },
    });

    assert.deepEqual(loaded, [{ id: "attachment-1", title: "Spec" }]);
  });

  it("summarizes issue data for widgets and session names", () => {
    assert.deepEqual(linearIssueSummary(issue, [{ id: "attachment-1" }]), {
      label: "LIN-123",
      title: "Fix login redirect",
      url: "https://linear.app/acme/issue/LIN-123/fix-login-redirect",
      branchName: "james/lin-123-fix-login-redirect",
      attachmentCount: 1,
    });
  });
});

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import linearExtension from "./index.ts";

interface RegisteredExtension {
  handlers: Record<string, Array<(event: unknown, ctx: unknown) => unknown>>;
  tools: unknown[];
  notifications: Array<{ message: string; level: string }>;
  sessionName?: string;
}

function createRegisteredExtension(
  options: Parameters<typeof linearExtension>[1] = {},
) {
  const registered: RegisteredExtension = {
    handlers: {},
    tools: [],
    notifications: [],
  };

  const pi = {
    on(eventName: string, handler: (event: unknown, ctx: unknown) => unknown) {
      registered.handlers[eventName] ??= [];
      registered.handlers[eventName].push(handler);
    },
    registerTool(tool: unknown) {
      registered.tools.push(tool);
    },
    setSessionName(name: string) {
      registered.sessionName = name;
    },
    getSessionName() {
      return registered.sessionName;
    },
  } as unknown as ExtensionAPI;

  linearExtension(pi, options);
  return registered;
}

function textFromWidget(widget: unknown): string {
  if (Array.isArray(widget)) return widget.join("\n");
  if (typeof widget === "function") {
    const component = widget(
      {},
      {
        fg(_name: string, text: string) {
          return text;
        },
        bold(text: string) {
          return text;
        },
      },
    ) as Component;
    return component.render(120).join("\n");
  }
  return String(widget ?? "");
}

describe("linear prompt widget extension", () => {
  it("registers no old linear tool", () => {
    const registered = createRegisteredExtension();

    assert.deepEqual(registered.tools, []);
  });

  it("warns at session start when LINEAR_API_KEY is missing", async () => {
    const previous = process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_API_KEY;
    const registered = createRegisteredExtension();

    try {
      await registered.handlers.session_start?.[0]?.(
        {},
        {
          hasUI: true,
          ui: {
            notify(message: string, level: string) {
              registered.notifications.push({ message, level });
            },
            setWidget() {},
          },
          sessionManager: { getBranch: () => [] },
        },
      );

      assert.deepEqual(registered.notifications, [
        {
          message:
            "linear: LINEAR_API_KEY is not set — Linear issue context will fail.",
          level: "warning",
        },
      ]);
    } finally {
      if (previous === undefined) delete process.env.LINEAR_API_KEY;
      else process.env.LINEAR_API_KEY = previous;
    }
  });

  it("injects issue context and renders a widget for matching prompts", async () => {
    process.env.LINEAR_API_KEY = "test-key";
    const widgets: Record<string, unknown> = {};
    const registered = createRegisteredExtension({
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
              branchName: "james/lin-123-fix-login-redirect",
              async attachments() {
                return {
                  nodes: [
                    {
                      id: "attachment-1",
                      title: "Spec",
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

    const result = (await registered.handlers.before_agent_start?.[0]?.(
      { prompt: "Analyze Linear issue: LIN-123" },
      {
        hasUI: true,
        ui: {
          setWidget(id: string, widget: unknown) {
            widgets[id] = widget;
          },
          notify() {},
        },
      },
    )) as
      | {
          message: { content: string; customType: string; display: boolean };
        }
      | undefined;

    assert.ok(result);
    assert.match(
      result.message.content,
      /# Linear Issue: LIN-123: Fix login redirect/,
    );
    assert.match(
      result.message.content,
      /Return users to their requested page\./,
    );
    assert.match(result.message.content, /Spec — https:\/\/example\.com\/spec/);
    assert.equal(result.message.customType, "linear-issue-context");
    assert.equal(result.message.display, false);
    assert.equal(registered.sessionName, "Linear: LIN-123 Fix login redirect");

    const widgetText = textFromWidget(widgets["linear-issue"]);
    assert.match(widgetText, /LIN-123: Fix login redirect/);
    assert.match(widgetText, /james\/lin-123-fix-login-redirect/);
    assert.match(widgetText, /1 attachment/);
    assert.match(widgetText, /https:\/\/linear\.app\/acme\/issue\/LIN-123/);
  });

  it("does not fetch or inject context for non-matching prompts", async () => {
    const registered = createRegisteredExtension({
      createClient() {
        return {
          issue() {
            throw new Error("should not fetch");
          },
        };
      },
    });

    const result = await registered.handlers.before_agent_start?.[0]?.(
      { prompt: "Please inspect LIN-123" },
      { hasUI: true, ui: { setWidget() {}, notify() {} } },
    );

    assert.equal(result, undefined);
  });

  it("shows an error widget and continues without injected context when fetch fails", async () => {
    process.env.LINEAR_API_KEY = "test-key";
    const widgets: Record<string, unknown> = {};
    const notifications: Array<{ message: string; level: string }> = [];
    const registered = createRegisteredExtension({
      createClient() {
        return {
          async issue() {
            throw new Error("not found");
          },
        };
      },
    });

    const result = await registered.handlers.before_agent_start?.[0]?.(
      { prompt: "Analyze Linear issue: LIN-404" },
      {
        hasUI: true,
        ui: {
          setWidget(id: string, widget: unknown) {
            widgets[id] = widget;
          },
          notify(message: string, level: string) {
            notifications.push({ message, level });
          },
        },
      },
    );

    assert.equal(result, undefined);
    assert.match(
      textFromWidget(widgets["linear-issue"]),
      /Failed to load LIN-404/,
    );
    assert.deepEqual(notifications, [
      { message: "linear: failed to load LIN-404: not found", level: "error" },
    ]);
  });

  it("restores widget from the latest matching user prompt on the active branch only", async () => {
    process.env.LINEAR_API_KEY = "test-key";
    const fetched: string[] = [];
    const widgets: Record<string, unknown> = {};
    const registered = createRegisteredExtension({
      createClient() {
        return {
          async issue(id: string) {
            fetched.push(id);
            return {
              id: "uuid-2",
              identifier: id,
              title: "Restored issue",
              url: `https://linear.app/acme/issue/${id}/restored-issue`,
            };
          },
        };
      },
    });

    await registered.handlers.session_start?.[0]?.(
      {},
      {
        hasUI: true,
        ui: {
          notify() {},
          setWidget(id: string, widget: unknown) {
            widgets[id] = widget;
          },
        },
        sessionManager: {
          getBranch() {
            return [
              {
                type: "message",
                message: {
                  role: "user",
                  content: [
                    { type: "text", text: "Analyze Linear issue: LIN-100" },
                  ],
                },
              },
              {
                type: "message",
                message: { role: "assistant", content: "ok" },
              },
              {
                type: "message",
                message: {
                  role: "user",
                  content: [
                    { type: "text", text: "Analyze Linear issue: LIN-200" },
                  ],
                },
              },
            ];
          },
        },
      },
    );

    assert.deepEqual(fetched, ["LIN-200"]);
    assert.match(
      textFromWidget(widgets["linear-issue"]),
      /LIN-200: Restored issue/,
    );
  });

  it("skips restore work when no UI is available", async () => {
    const registered = createRegisteredExtension({
      createClient() {
        return {
          issue() {
            throw new Error("should not fetch without UI");
          },
        };
      },
    });

    await registered.handlers.session_start?.[0]?.(
      {},
      {
        hasUI: false,
        ui: { notify() {}, setWidget() {} },
        sessionManager: {
          getBranch() {
            throw new Error("should not scan without UI");
          },
        },
      },
    );
  });
});
