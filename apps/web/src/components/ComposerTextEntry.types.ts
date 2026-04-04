import type { ClipboardEventHandler } from "react";

import type { TerminalContextDraft } from "~/lib/terminalContext";

export interface ComposerTextEntryProps {
  value: string;
  cursor: number;
  terminalContexts: ReadonlyArray<TerminalContextDraft>;
  disabled: boolean;
  placeholder: string;
  className?: string;
  onRemoveTerminalContext: (contextId: string) => void;
  onChange: (
    nextValue: string,
    nextCursor: number,
    expandedCursor: number,
    cursorAdjacentToMention: boolean,
    terminalContextIds: string[],
  ) => void;
  onCommandKeyDown?: (
    key: "ArrowDown" | "ArrowUp" | "Enter" | "Tab",
    event: KeyboardEvent,
  ) => boolean;
  onPaste: ClipboardEventHandler<HTMLElement>;
}
