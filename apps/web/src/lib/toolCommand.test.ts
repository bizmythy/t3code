import { describe, expect, it } from "vitest";

import { normalizeToolCommandValue } from "./toolCommand";

describe("normalizeToolCommandValue", () => {
  it("unwraps shell launcher arrays", () => {
    expect(
      normalizeToolCommandValue([
        "/bin/zsh",
        "-lc",
        "ls -la /workspace && find /workspace -maxdepth 2 -type d",
      ]),
    ).toBe("ls -la /workspace && find /workspace -maxdepth 2 -type d");
  });

  it("unwraps shell launcher strings", () => {
    expect(
      normalizeToolCommandValue(
        '/bin/zsh -lc "sed -n \\"1,220p\\" apps/server/src/project/Layers/ProjectFaviconResolver.ts"',
      ),
    ).toBe('sed -n \\"1,220p\\" apps/server/src/project/Layers/ProjectFaviconResolver.ts');
  });

  it("keeps direct shell commands that are not launcher wrappers", () => {
    expect(normalizeToolCommandValue(["bash", "scripts/setup-dev.sh"])).toBe(
      "bash scripts/setup-dev.sh",
    );
  });

  it("keeps regular commands untouched", () => {
    expect(normalizeToolCommandValue(["bun", "run", "lint"])).toBe("bun run lint");
  });
});
