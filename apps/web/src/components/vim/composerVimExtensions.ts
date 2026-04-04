import { EditorState } from "@codemirror/state";
import { EditorView, ViewUpdate, placeholder } from "@codemirror/view";
import { getCM } from "@replit/codemirror-vim";
import type { ClipboardEventHandler, RefObject } from "react";

type CommandKey = "ArrowDown" | "ArrowUp" | "Enter" | "Tab";
type OnCommandKeyDown = ((key: CommandKey, event: KeyboardEvent) => boolean) | undefined;

export function createComposerVimEditableExtension(disabled: boolean) {
  return [EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)];
}

export function createComposerVimPlaceholderExtension(placeholderText: string) {
  return placeholder(placeholderText);
}

export function createComposerVimUpdateListener(onUpdate: (update: ViewUpdate) => void) {
  return EditorView.updateListener.of(onUpdate);
}

export function createComposerVimDomEventHandlers(input: {
  onCommandKeyDownRef: RefObject<OnCommandKeyDown>;
  onPasteRef: RefObject<ClipboardEventHandler<HTMLElement>>;
}) {
  return EditorView.domEventHandlers({
    keydown(event, view) {
      const cm = getCM(view);
      if (!cm?.state.vim?.insertMode) {
        return false;
      }

      let key: CommandKey | null = null;
      if (event.key === "ArrowDown") key = "ArrowDown";
      if (event.key === "ArrowUp") key = "ArrowUp";
      if (event.key === "Enter" && !event.shiftKey) key = "Enter";
      if (event.key === "Tab") key = "Tab";
      if (!key) {
        return false;
      }

      const handled = input.onCommandKeyDownRef.current?.(key, event) ?? false;
      if (!handled) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    paste(event) {
      input.onPasteRef.current(
        event as unknown as Parameters<ClipboardEventHandler<HTMLElement>>[0],
      );
      return event.defaultPrevented;
    },
  });
}

export function readComposerVimSelectionCursor(view: EditorView): number {
  return Math.max(0, Math.min(view.state.doc.length, view.state.selection.main.head));
}
