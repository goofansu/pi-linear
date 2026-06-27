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

  it("does not match arbitrary issue ids in prose", () => {
    assert.equal(extractLinearPromptMatch("Please inspect LIN-123"), undefined);
    assert.equal(
      extractLinearPromptMatch("Analyze GitHub issue: LIN-123"),
      undefined,
    );
    assert.equal(extractLinearPromptMatch("Analyze Linear issue"), undefined);
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
