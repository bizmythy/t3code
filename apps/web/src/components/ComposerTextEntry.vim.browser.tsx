import "../index.css";

import { useState } from "react";
import { DEFAULT_SERVER_SETTINGS, type ServerConfig, type ThreadId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { detectComposerTrigger } from "~/composer-logic";
import {
  INLINE_TERMINAL_CONTEXT_PLACEHOLDER,
  removeInlineTerminalContextPlaceholder,
  type TerminalContextDraft,
} from "~/lib/terminalContext";
import { __resetNativeApiForTests } from "~/nativeApi";
import { AppAtomRegistryProvider } from "~/rpc/atomRegistry";
import { resetServerStateForTests, setServerConfigSnapshot } from "~/rpc/serverState";
import { ComposerTextEntry } from "./ComposerTextEntry";

const CLIENT_SETTINGS_STORAGE_KEY = "t3code:client-settings:v1";
const THREAD_ID = "thread-vim-test" as ThreadId;

function createBaseServerConfig(): ServerConfig {
  return {
    cwd: "/repo/project",
    keybindingsConfigPath: "/repo/project/.t3code-keybindings.json",
    keybindings: [],
    issues: [],
    providers: [],
    availableEditors: [],
    observability: {
      logsDirectoryPath: "/repo/project/.t3/logs",
      localTracingEnabled: true,
      otlpTracesEnabled: false,
      otlpMetricsEnabled: false,
    },
    settings: DEFAULT_SERVER_SETTINGS,
  };
}

function createTerminalContext(id: string): TerminalContextDraft {
  return {
    id,
    threadId: THREAD_ID,
    terminalId: `terminal-${id}`,
    terminalLabel: `Terminal ${id}`,
    lineStart: 3,
    lineEnd: 4,
    text: "git status\nclean",
    createdAt: "2026-04-04T12:00:00.000Z",
  };
}

function dispatchComposerVimKey(key: string) {
  const content = document.querySelector(".cm-content");
  if (!(content instanceof HTMLElement)) {
    return;
  }
  content.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function ComposerHarness(input?: {
  initialValue?: string;
  initialCursor?: number;
  initialTerminalContexts?: ReadonlyArray<TerminalContextDraft>;
}) {
  const [state, setState] = useState(() => ({
    value: input?.initialValue ?? "",
    cursor: input?.initialCursor ?? 0,
    expandedCursor: input?.initialCursor ?? 0,
    terminalContexts: [...(input?.initialTerminalContexts ?? [])],
    terminalContextIds: (input?.initialTerminalContexts ?? []).map((context) => context.id),
    handledKeys: [] as string[],
  }));
  const trigger = detectComposerTrigger(state.value, state.expandedCursor);

  return (
    <div>
      <ComposerTextEntry
        value={state.value}
        cursor={state.cursor}
        terminalContexts={state.terminalContexts}
        disabled={false}
        placeholder="Ask anything"
        onRemoveTerminalContext={(contextId) => {
          setState((current) => {
            const index = current.terminalContexts.findIndex((context) => context.id === contextId);
            if (index < 0) {
              return current;
            }
            const nextPrompt = removeInlineTerminalContextPlaceholder(current.value, index);
            const nextTerminalContexts = current.terminalContexts.filter(
              (context) => context.id !== contextId,
            );
            return {
              ...current,
              value: nextPrompt.prompt,
              cursor: nextPrompt.cursor,
              expandedCursor: nextPrompt.cursor,
              terminalContexts: nextTerminalContexts,
              terminalContextIds: nextTerminalContexts.map((context) => context.id),
            };
          });
        }}
        onChange={(
          nextValue,
          nextCursor,
          expandedCursor,
          _cursorAdjacentToMention,
          terminalIds,
        ) => {
          setState((current) => ({
            ...current,
            value: nextValue,
            cursor: nextCursor,
            expandedCursor,
            terminalContextIds: terminalIds,
          }));
        }}
        onCommandKeyDown={(key) => {
          if (key !== "Enter") {
            return false;
          }
          setState((current) => ({
            ...current,
            handledKeys: [...current.handledKeys, key],
          }));
          return true;
        }}
        onPaste={() => {}}
      />
      <div data-testid="composer-value">{state.value}</div>
      <div data-testid="composer-cursor">{String(state.cursor)}</div>
      <div data-testid="composer-terminal-context-ids">{state.terminalContextIds.join(",")}</div>
      <div data-testid="composer-handled-keys">{state.handledKeys.join(",")}</div>
      <div data-testid="composer-trigger-kind">{trigger?.kind ?? "none"}</div>
      <button
        type="button"
        data-testid="simulate-vim-insert"
        onClick={() => dispatchComposerVimKey("i")}
      >
        insert
      </button>
      <button
        type="button"
        data-testid="simulate-vim-enter"
        onClick={() => dispatchComposerVimKey("Enter")}
      >
        enter
      </button>
      <button
        type="button"
        data-testid="simulate-vim-escape"
        onClick={() => dispatchComposerVimKey("Escape")}
      >
        escape
      </button>
    </div>
  );
}

async function renderHarness(input?: {
  initialValue?: string;
  initialCursor?: number;
  initialTerminalContexts?: ReadonlyArray<TerminalContextDraft>;
}) {
  setServerConfigSnapshot(createBaseServerConfig());
  return render(
    <AppAtomRegistryProvider>
      <ComposerHarness {...(input ?? {})} />
    </AppAtomRegistryProvider>,
  );
}

describe("ComposerTextEntry vim mode", () => {
  beforeEach(() => {
    resetServerStateForTests();
    __resetNativeApiForTests();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    resetServerStateForTests();
    __resetNativeApiForTests();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("keeps the default lexical composer mounted when vim mode is disabled", async () => {
    await renderHarness();

    await expect.element(page.getByTestId("composer-editor")).toBeInTheDocument();
    expect(document.querySelector('[data-testid="composer-vim-editor"]')).toBeNull();
  });

  it("mounts the vim composer when vim mode is enabled", async () => {
    localStorage.setItem(
      CLIENT_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_CLIENT_SETTINGS,
        composerVimModeEnabled: true,
      }),
    );

    await renderHarness();

    await expect.element(page.getByTestId("composer-vim-editor")).toBeInTheDocument();
    expect(document.querySelector('[data-testid="composer-editor"]')).toBeNull();
    expect(document.querySelector(".cm-editor")).not.toBeNull();
  });

  it("supports vim mode editing, command handling, and trigger detection", async () => {
    localStorage.setItem(
      CLIENT_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_CLIENT_SETTINGS,
        composerVimModeEnabled: true,
      }),
    );

    await renderHarness();

    const editor = page.getByTestId("composer-vim-editor");
    await editor.click();

    await vi.waitFor(
      () => {
        expect(document.body.textContent).toContain("--NORMAL--");
      },
      { timeout: 8_000, interval: 16 },
    );

    await page.getByTestId("simulate-vim-insert").click();
    await vi.waitFor(
      () => {
        expect(document.body.textContent).toContain("--INSERT--");
      },
      { timeout: 8_000, interval: 16 },
    );

    await editor.fill("@src/");
    await vi.waitFor(
      () => {
        expect(document.querySelector('[data-testid="composer-value"]')?.textContent).toBe("@src/");
        expect(document.querySelector('[data-testid="composer-trigger-kind"]')?.textContent).toBe(
          "path",
        );
      },
      { timeout: 8_000, interval: 16 },
    );

    await page.getByTestId("simulate-vim-enter").click();
    await vi.waitFor(
      () => {
        expect(document.querySelector('[data-testid="composer-handled-keys"]')?.textContent).toBe(
          "Enter",
        );
        expect(document.querySelector('[data-testid="composer-value"]')?.textContent).toBe("@src/");
      },
      { timeout: 8_000, interval: 16 },
    );

    await page.getByTestId("simulate-vim-escape").click();
    await vi.waitFor(
      () => {
        expect(document.body.textContent).toContain("--NORMAL--");
      },
      { timeout: 8_000, interval: 16 },
    );
  });

  it("renders terminal context widgets and removes them through the shared callback path", async () => {
    localStorage.setItem(
      CLIENT_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_CLIENT_SETTINGS,
        composerVimModeEnabled: true,
      }),
    );

    await renderHarness({
      initialValue: INLINE_TERMINAL_CONTEXT_PLACEHOLDER,
      initialTerminalContexts: [createTerminalContext("ctx-1")],
    });

    await expect
      .element(page.getByTestId("composer-vim-terminal-context-ctx-1"))
      .toBeInTheDocument();
    await expect
      .element(page.getByTestId("composer-terminal-context-ids"))
      .toHaveTextContent("ctx-1");

    await page.getByLabelText("Remove Terminal ctx-1 lines 3-4").click();

    await vi.waitFor(
      () => {
        expect(document.querySelector('[data-testid="composer-vim-terminal-context-ctx-1"]')).toBe(
          null,
        );
        expect(
          document.querySelector('[data-testid="composer-terminal-context-ids"]')?.textContent,
        ).toBe("");
        expect(document.querySelector('[data-testid="composer-value"]')?.textContent).toBe("");
      },
      { timeout: 8_000, interval: 16 },
    );
  });
});
