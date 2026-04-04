function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function commandExecutableName(command: string): string {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const normalized = trimmed.replace(/^["']|["']$/g, "");
  const segments = normalized.split(/[\\/]/);
  return (segments.at(-1) ?? normalized).toLowerCase();
}

function unwrapShellWrappedCommandParts(parts: ReadonlyArray<string>): string | null {
  const executable = parts[0];
  if (!executable) {
    return null;
  }

  const executableName = commandExecutableName(executable);
  const isPosixShell = ["sh", "bash", "zsh", "fish", "dash", "ksh"].includes(executableName);
  if (isPosixShell) {
    for (let index = 1; index < parts.length - 1; index += 1) {
      const option = parts[index];
      if (typeof option !== "string") {
        continue;
      }
      if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(option)) {
        return asTrimmedString(parts[index + 1]);
      }
    }
  }

  if (executableName === "cmd" || executableName === "cmd.exe") {
    for (let index = 1; index < parts.length - 1; index += 1) {
      const option = parts[index]?.toLowerCase();
      if (option === "/c" || option === "/k") {
        return asTrimmedString(parts[index + 1]);
      }
    }
  }

  if (
    executableName === "powershell" ||
    executableName === "powershell.exe" ||
    executableName === "pwsh" ||
    executableName === "pwsh.exe"
  ) {
    for (let index = 1; index < parts.length - 1; index += 1) {
      const option = parts[index]?.toLowerCase();
      if (option === "-command" || option === "-c") {
        return asTrimmedString(parts[index + 1]);
      }
    }
  }

  return null;
}

function normalizeCommandParts(parts: ReadonlyArray<string>): string | null {
  if (parts.length === 0) {
    return null;
  }
  return unwrapShellWrappedCommandParts(parts) ?? parts.join(" ");
}

function stripMatchingOuterQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const quote = value[0];
  if ((quote === "'" || quote === '"') && value.at(-1) === quote) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeCommandString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const wrapperMatch =
    /^(?<shell>"[^"]+"|'[^']+'|\S+)\s+(?<flag>-[A-Za-z]*c[A-Za-z]*|\/[cCkK]|-Command|-command)\s+(?<command>[\s\S]+)$/u.exec(
      trimmed,
    );
  if (!wrapperMatch?.groups) {
    return trimmed;
  }

  const wrappedShell = asTrimmedString(wrapperMatch.groups.shell);
  const wrappedCommand = asTrimmedString(wrapperMatch.groups.command);
  if (!wrappedShell || !wrappedCommand) {
    return trimmed;
  }

  const executableName = commandExecutableName(wrappedShell);
  const isSupportedShell =
    ["sh", "bash", "zsh", "fish", "dash", "ksh"].includes(executableName) ||
    executableName === "cmd" ||
    executableName === "cmd.exe" ||
    executableName === "powershell" ||
    executableName === "powershell.exe" ||
    executableName === "pwsh" ||
    executableName === "pwsh.exe";
  if (!isSupportedShell) {
    return trimmed;
  }

  return stripMatchingOuterQuotes(wrappedCommand);
}

export function normalizeToolCommandValue(value: unknown): string | null {
  const direct = asTrimmedString(value);
  if (direct) {
    return normalizeCommandString(direct);
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const parts = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);
  return normalizeCommandParts(parts);
}
