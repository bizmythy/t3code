import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { minimalSetup } from "codemirror";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { cn } from "~/lib/utils";
import type { ComposerTextEntryProps } from "../ComposerTextEntry.types";
import type { ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import {
  createComposerVimDomEventHandlers,
  createComposerVimEditableExtension,
  createComposerVimPlaceholderExtension,
  createComposerVimUpdateListener,
  readComposerVimSelectionCursor,
} from "./composerVimExtensions";
import {
  createComposerVimTerminalContextExtension,
  readComposerVimTerminalContextIds,
  setComposerVimTerminalContextIdsEffect,
} from "./composerVimTerminalContextDecorations";
import { composerVimTheme } from "./composerVimTheme";

type ComposerVimPromptEditorProps = ComposerTextEntryProps;

function terminalContextSignature(
  contexts: ComposerVimPromptEditorProps["terminalContexts"],
): string {
  return contexts
    .map((context) =>
      [
        context.id,
        context.threadId,
        context.terminalId,
        context.terminalLabel,
        context.lineStart,
        context.lineEnd,
        context.createdAt,
        context.text,
      ].join("\u001f"),
    )
    .join("\u001e");
}

function clampCursor(value: string, cursor: number): number {
  if (!Number.isFinite(cursor)) {
    return value.length;
  }
  return Math.max(0, Math.min(value.length, Math.floor(cursor)));
}

function buildSnapshot(view: EditorView) {
  return {
    value: view.state.doc.toString(),
    cursor: readComposerVimSelectionCursor(view),
    expandedCursor: readComposerVimSelectionCursor(view),
    terminalContextIds: readComposerVimTerminalContextIds(view.state),
  };
}

export const ComposerVimPromptEditor = forwardRef<
  ComposerPromptEditorHandle,
  ComposerVimPromptEditorProps
>(function ComposerVimPromptEditor(
  {
    value,
    cursor,
    terminalContexts,
    disabled,
    placeholder,
    className,
    onRemoveTerminalContext,
    onChange,
    onCommandKeyDown,
    onPaste,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCommandKeyDownRef = useRef(onCommandKeyDown);
  const onPasteRef = useRef(onPaste);
  const onRemoveTerminalContextRef = useRef(onRemoveTerminalContext);
  const isApplyingExternalUpdateRef = useRef(false);
  const placeholderCompartmentRef = useRef(new Compartment());
  const editableCompartmentRef = useRef(new Compartment());
  const terminalContextCompartmentRef = useRef(new Compartment());
  const initialStateRef = useRef({
    value,
    cursor,
    terminalContexts,
    disabled,
    placeholder,
  });
  const terminalContextsSignatureRef = useRef(terminalContextSignature(terminalContexts));
  const placeholderRef = useRef(placeholder);
  const disabledRef = useRef(disabled);
  const snapshotRef = useRef({
    value,
    cursor: clampCursor(value, cursor),
    expandedCursor: clampCursor(value, cursor),
    terminalContextIds: terminalContexts.map((context) => context.id),
  });

  useEffect(() => {
    onChangeRef.current = onChange;
    onCommandKeyDownRef.current = onCommandKeyDown;
    onPasteRef.current = onPaste;
    onRemoveTerminalContextRef.current = onRemoveTerminalContext;
  }, [onChange, onCommandKeyDown, onPaste, onRemoveTerminalContext]);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const initialState = initialStateRef.current;
    const initialCursor = clampCursor(initialState.value, initialState.cursor);
    const view = new EditorView({
      state: EditorState.create({
        doc: initialState.value,
        selection: EditorSelection.cursor(initialCursor),
        extensions: [
          vim({ status: true }),
          minimalSetup,
          EditorView.lineWrapping,
          composerVimTheme,
          placeholderCompartmentRef.current.of(
            createComposerVimPlaceholderExtension(initialState.placeholder),
          ),
          editableCompartmentRef.current.of(
            createComposerVimEditableExtension(initialState.disabled),
          ),
          terminalContextCompartmentRef.current.of(
            createComposerVimTerminalContextExtension({
              contexts: initialState.terminalContexts,
              onRemoveTerminalContext: (contextId) => {
                onRemoveTerminalContextRef.current(contextId);
              },
            }),
          ),
          createComposerVimDomEventHandlers({
            onCommandKeyDownRef,
            onPasteRef,
          }),
          createComposerVimUpdateListener((update) => {
            if (!update.docChanged && !update.selectionSet) {
              return;
            }
            if (isApplyingExternalUpdateRef.current) {
              return;
            }
            const nextSnapshot = buildSnapshot(update.view);
            const previousSnapshot = snapshotRef.current;
            if (
              previousSnapshot.value === nextSnapshot.value &&
              previousSnapshot.cursor === nextSnapshot.cursor &&
              previousSnapshot.expandedCursor === nextSnapshot.expandedCursor &&
              previousSnapshot.terminalContextIds.length ===
                nextSnapshot.terminalContextIds.length &&
              previousSnapshot.terminalContextIds.every(
                (id, index) => id === nextSnapshot.terminalContextIds[index],
              )
            ) {
              return;
            }
            snapshotRef.current = nextSnapshot;
            onChangeRef.current(
              nextSnapshot.value,
              nextSnapshot.cursor,
              nextSnapshot.expandedCursor,
              false,
              nextSnapshot.terminalContextIds,
            );
          }),
        ],
      }),
      parent: hostRef.current,
    });

    viewRef.current = view;
    snapshotRef.current = buildSnapshot(view);

    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const normalizedCursor = clampCursor(value, cursor);
    const nextTerminalContextsSignature = terminalContextSignature(terminalContexts);
    const effects = [];

    if (placeholderRef.current !== placeholder) {
      effects.push(
        placeholderCompartmentRef.current.reconfigure(
          createComposerVimPlaceholderExtension(placeholder),
        ),
      );
      placeholderRef.current = placeholder;
    }

    if (disabledRef.current !== disabled) {
      effects.push(
        editableCompartmentRef.current.reconfigure(createComposerVimEditableExtension(disabled)),
      );
      disabledRef.current = disabled;
    }

    if (terminalContextsSignatureRef.current !== nextTerminalContextsSignature) {
      effects.push(
        terminalContextCompartmentRef.current.reconfigure(
          createComposerVimTerminalContextExtension({
            contexts: terminalContexts,
            onRemoveTerminalContext: (contextId) => {
              onRemoveTerminalContextRef.current(contextId);
            },
          }),
        ),
        setComposerVimTerminalContextIdsEffect.of(terminalContexts.map((context) => context.id)),
      );
      terminalContextsSignatureRef.current = nextTerminalContextsSignature;
    }

    const currentValue = view.state.doc.toString();
    const currentCursor = readComposerVimSelectionCursor(view);
    const needsValueUpdate = currentValue !== value;
    const needsCursorUpdate = currentCursor !== normalizedCursor;

    if (!needsValueUpdate && !needsCursorUpdate && effects.length === 0) {
      return;
    }

    isApplyingExternalUpdateRef.current = true;
    view.dispatch({
      ...(needsValueUpdate
        ? {
            changes: {
              from: 0,
              to: currentValue.length,
              insert: value,
            },
          }
        : {}),
      ...(needsValueUpdate || needsCursorUpdate
        ? { selection: EditorSelection.cursor(normalizedCursor) }
        : {}),
      ...(effects.length > 0 ? { effects } : {}),
    });
    snapshotRef.current = buildSnapshot(view);
    queueMicrotask(() => {
      isApplyingExternalUpdateRef.current = false;
    });
  }, [cursor, disabled, placeholder, terminalContexts, value]);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.focus();
        view.dispatch({
          selection: EditorSelection.cursor(snapshotRef.current.cursor),
        });
      },
      focusAt(nextCursor) {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        const boundedCursor = clampCursor(view.state.doc.toString(), nextCursor);
        view.focus();
        view.dispatch({
          selection: EditorSelection.cursor(boundedCursor),
        });
        snapshotRef.current = buildSnapshot(view);
      },
      focusAtEnd() {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        const endCursor = view.state.doc.length;
        view.focus();
        view.dispatch({
          selection: EditorSelection.cursor(endCursor),
        });
        snapshotRef.current = buildSnapshot(view);
      },
      readSnapshot() {
        const view = viewRef.current;
        if (!view) {
          return snapshotRef.current;
        }
        snapshotRef.current = buildSnapshot(view);
        return snapshotRef.current;
      },
    }),
    [],
  );

  return (
    <div
      className={cn("relative", className)}
      data-testid="composer-vim-editor"
      data-vim-mode="true"
    >
      <div ref={hostRef} />
    </div>
  );
});
