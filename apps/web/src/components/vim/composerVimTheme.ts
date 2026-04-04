import { EditorView } from "@codemirror/view";

export const composerVimTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--color-foreground)",
    fontFamily: '"SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: "14px",
    lineHeight: "1.625",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflowY: "auto",
    maxHeight: "200px",
    minHeight: "70px",
    fontFamily: "inherit",
    lineHeight: "inherit",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--color-foreground)",
    fontFamily: "inherit",
    minHeight: "70px",
  },
  ".cm-line": {
    padding: "0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  ".cm-placeholder": {
    color: "color-mix(in srgb, var(--color-muted-foreground) 35%, transparent)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--color-accent-foreground) 12%, transparent)",
  },
  ".cm-vim-panel": {
    marginTop: "8px",
    borderTop: "1px solid color-mix(in srgb, var(--color-border) 75%, transparent)",
    padding: "6px 0 0",
    color: "var(--color-muted-foreground)",
    fontFamily: "inherit",
    fontSize: "12px",
    lineHeight: "1.4",
    minHeight: "1.3em",
  },
  ".cm-vim-panel input": {
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "inherit",
    fontFamily: "inherit",
  },
});
