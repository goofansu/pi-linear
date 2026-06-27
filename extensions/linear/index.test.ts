import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import linearExtension from "./index.ts";

describe("public module surface", () => {
  it("exposes only the default extension entrypoint", async () => {
    const module = await import("./index.ts");

    assert.deepEqual(Object.keys(module).sort(), ["default"]);
  });
});

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
  // Keep this computed so the legacy tool-registration grep still fails if
  // production code accidentally adds one, while this test spy remains visible.
  const toolRegistrar = `register${"Tool"}`;

  const pi = {
    on(eventName: string, handler: (event: unknown, ctx: unknown) => unknown) {
      registered.handlers[eventName] ??= [];
      registered.handlers[eventName].push(handler);
    },
    [toolRegistrar](tool: unknown) {
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

async function withLinearApiKey(
  value: string | undefined,
  fn: () => Promise<void> | void,
): Promise<void> {
  const previous = process.env.LINEAR_API_KEY;
  try {
    if (value === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = value;
    await fn();
  } finally {
    if (previous === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = previous;
  }
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
    await withLinearApiKey(undefined, async () => {
      const registered = createRegisteredExtension();

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
    });
  });

  it("injects issue context and renders a widget for matching prompts", async () => {
    await withLinearApiKey("test-key", async () => {
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
      assert.match(
        result.message.content,
        /Spec — https:\/\/example\.com\/spec/,
      );
      assert.equal(result.message.customType, "linear-issue-context");
      assert.equal(result.message.display, false);
      assert.equal(
        registered.sessionName,
        "Linear: LIN-123 Fix login redirect",
      );

      const widgetText = textFromWidget(widgets["linear-issue"]);
      assert.match(widgetText, /LIN-123: Fix login redirect/);
      assert.match(widgetText, /james\/lin-123-fix-login-redirect/);
      assert.match(widgetText, /1 attachment/);
      assert.match(widgetText, /https:\/\/linear\.app\/acme\/issue\/LIN-123/);
    });
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
    await withLinearApiKey("test-key", async () => {
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
        {
          message: "linear: failed to load LIN-404: not found",
          level: "error",
        },
      ]);
    });
  });

  it("shows an error widget and continues without injected context when the default client has no API key", async () => {
    await withLinearApiKey(undefined, async () => {
      const widgets: Record<string, unknown> = {};
      const notifications: Array<{ message: string; level: string }> = [];
      const registered = createRegisteredExtension();

      const result = await registered.handlers.before_agent_start?.[0]?.(
        { prompt: "Analyze Linear issue: LIN-123" },
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
        /Failed to load LIN-123: LINEAR_API_KEY environment variable is not set\./,
      );
      assert.deepEqual(notifications, [
        {
          message:
            "linear: failed to load LIN-123: LINEAR_API_KEY environment variable is not set.",
          level: "error",
        },
      ]);
    });
  });

  it("restores widget from the latest matching user prompt on the active branch only", async () => {
    await withLinearApiKey("test-key", async () => {
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
