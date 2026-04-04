import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ClientSettingsSchema, DEFAULT_CLIENT_SETTINGS } from "./settings";

describe("client settings vim mode", () => {
  it("defaults composer vim mode to disabled", () => {
    expect(DEFAULT_CLIENT_SETTINGS.composerVimModeEnabled).toBe(false);
    expect(Schema.decodeSync(ClientSettingsSchema)({}).composerVimModeEnabled).toBe(false);
  });

  it("decodes stored composer vim mode values", () => {
    expect(
      Schema.decodeSync(ClientSettingsSchema)({
        composerVimModeEnabled: true,
      }).composerVimModeEnabled,
    ).toBe(true);
  });
});
