import "../../index.css";

import { DEFAULT_SERVER_SETTINGS, type ServerConfig } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { __resetNativeApiForTests } from "../../nativeApi";
import { AppAtomRegistryProvider } from "../../rpc/atomRegistry";
import { resetServerStateForTests, setServerConfigSnapshot } from "../../rpc/serverState";
import { GeneralSettingsPanel } from "./SettingsPanels";

const CLIENT_SETTINGS_STORAGE_KEY = "t3code:client-settings:v1";

function createBaseServerConfig(): ServerConfig {
  return {
    cwd: "/repo/project",
    keybindingsConfigPath: "/repo/project/.t3code-keybindings.json",
    keybindings: [],
    issues: [],
    providers: [],
    availableEditors: ["cursor"],
    observability: {
      logsDirectoryPath: "/repo/project/.t3/logs",
      localTracingEnabled: true,
      otlpTracesEnabled: false,
      otlpMetricsEnabled: false,
    },
    settings: DEFAULT_SERVER_SETTINGS,
  };
}

describe("GeneralSettingsPanel vim mode", () => {
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

  it("toggles composer vim mode and resets it to default", async () => {
    setServerConfigSnapshot(createBaseServerConfig());

    await render(
      <AppAtomRegistryProvider>
        <GeneralSettingsPanel />
      </AppAtomRegistryProvider>,
    );

    const vimModeToggle = page.getByLabelText("Enable vim mode in the composer");
    await expect.element(vimModeToggle).toBeInTheDocument();
    await vimModeToggle.click();

    await expect.element(page.getByLabelText("Reset vim mode to default")).toBeInTheDocument();

    expect(JSON.parse(localStorage.getItem(CLIENT_SETTINGS_STORAGE_KEY) ?? "{}")).toEqual({
      ...DEFAULT_CLIENT_SETTINGS,
      composerVimModeEnabled: true,
    });

    await page.getByLabelText("Reset vim mode to default").click();
    expect(JSON.parse(localStorage.getItem(CLIENT_SETTINGS_STORAGE_KEY) ?? "{}")).toEqual({
      ...DEFAULT_CLIENT_SETTINGS,
      composerVimModeEnabled: false,
    });
  });
});
