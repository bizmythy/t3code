import {
  EditorState,
  Facet,
  RangeSet,
  RangeSetBuilder,
  RangeValue,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";

import {
  COMPOSER_INLINE_CHIP_CLASS_NAME,
  COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME,
} from "../composerInlineChip";
import {
  INLINE_TERMINAL_CONTEXT_PLACEHOLDER,
  formatTerminalContextLabel,
  isTerminalContextExpired,
  type TerminalContextDraft,
} from "~/lib/terminalContext";

class TerminalContextRangeValue extends RangeValue {
  constructor(readonly contextId: string) {
    super();
  }

  override eq(other: TerminalContextRangeValue): boolean {
    return other.contextId === this.contextId;
  }
}

export const setComposerVimTerminalContextIdsEffect = StateEffect.define<ReadonlyArray<string>>();

function buildTerminalContextRangeSet(docText: string, contextIds: ReadonlyArray<string>) {
  const builder = new RangeSetBuilder<TerminalContextRangeValue>();
  let contextIndex = 0;

  for (let position = 0; position < docText.length; position += 1) {
    if (docText[position] !== INLINE_TERMINAL_CONTEXT_PLACEHOLDER) {
      continue;
    }

    const contextId = contextIds[contextIndex] ?? null;
    contextIndex += 1;
    if (!contextId) {
      continue;
    }
    builder.add(position, position + 1, new TerminalContextRangeValue(contextId));
  }

  return builder.finish();
}

function filterTerminalContextRangeSet(
  docText: string,
  ranges: RangeSet<TerminalContextRangeValue>,
): RangeSet<TerminalContextRangeValue> {
  const builder = new RangeSetBuilder<TerminalContextRangeValue>();
  ranges.between(0, docText.length, (from, to, value) => {
    if (to - from !== 1) {
      return;
    }
    if (docText[from] !== INLINE_TERMINAL_CONTEXT_PLACEHOLDER) {
      return;
    }
    builder.add(from, to, value);
  });
  return builder.finish();
}

export const composerVimTerminalContextField = StateField.define<
  RangeSet<TerminalContextRangeValue>
>({
  create(state) {
    const contextIds = state
      .facet(composerVimTerminalContextConfigFacet)
      .contexts.map((context) => context.id);
    return buildTerminalContextRangeSet(state.doc.toString(), contextIds);
  },
  update(value, transaction) {
    const resetEffect = transaction.effects.find((effect) =>
      effect.is(setComposerVimTerminalContextIdsEffect),
    );
    if (resetEffect) {
      return buildTerminalContextRangeSet(transaction.state.doc.toString(), resetEffect.value);
    }
    if (!transaction.docChanged) {
      return value;
    }
    return filterTerminalContextRangeSet(
      transaction.state.doc.toString(),
      value.map(transaction.changes),
    );
  },
});

type ComposerVimTerminalContextConfig = {
  contexts: ReadonlyArray<TerminalContextDraft>;
  onRemoveTerminalContext: (contextId: string) => void;
};

const emptyTerminalContextConfig: ComposerVimTerminalContextConfig = {
  contexts: [],
  onRemoveTerminalContext: () => {},
};

export const composerVimTerminalContextConfigFacet = Facet.define<
  ComposerVimTerminalContextConfig,
  ComposerVimTerminalContextConfig
>({
  combine(values) {
    return values[0] ?? emptyTerminalContextConfig;
  },
});

class TerminalContextWidget extends WidgetType {
  constructor(
    readonly context: TerminalContextDraft,
    readonly onRemoveTerminalContext: (contextId: string) => void,
  ) {
    super();
  }

  override eq(other: TerminalContextWidget): boolean {
    return (
      other.context.id === this.context.id &&
      other.context.text === this.context.text &&
      other.context.lineStart === this.context.lineStart &&
      other.context.lineEnd === this.context.lineEnd &&
      other.context.terminalLabel === this.context.terminalLabel
    );
  }

  override toDOM(): HTMLElement {
    const expired = isTerminalContextExpired(this.context);
    const label = formatTerminalContextLabel(this.context);
    const wrap = document.createElement("span");
    wrap.className = `${COMPOSER_INLINE_CHIP_CLASS_NAME} ${
      expired ? "border-destructive/35 bg-destructive/8 text-destructive" : ""
    }`;
    wrap.setAttribute("data-testid", `composer-vim-terminal-context-${this.context.id}`);
    wrap.title = expired
      ? `Terminal context expired. Remove and re-add ${label} to include it in your message.`
      : this.context.text;

    const icon = document.createElement("span");
    icon.className = COMPOSER_INLINE_CHIP_ICON_CLASS_NAME;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = ">_";

    const text = document.createElement("span");
    text.className = COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME;
    text.textContent = label;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME;
    removeButton.setAttribute("aria-label", `Remove ${label}`);
    removeButton.dataset.contextId = this.context.id;
    removeButton.textContent = "×";
    removeButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onRemoveTerminalContext(this.context.id);
    });

    wrap.append(icon, text, removeButton);
    return wrap;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

export function createComposerVimTerminalContextExtension(
  config: ComposerVimTerminalContextConfig,
) {
  const widgetPlugin = ViewPlugin.fromClass(
    class {
      decorations = this.buildDecorations();

      constructor(readonly view: EditorView) {}

      update() {
        this.decorations = this.buildDecorations();
      }

      buildDecorations() {
        const currentConfig = this.view.state.facet(composerVimTerminalContextConfigFacet);
        const contextById = new Map(
          currentConfig.contexts.map((context) => [context.id, context] as const),
        );
        const ranges = this.view.state.field(composerVimTerminalContextField);
        const builder = new RangeSetBuilder<Decoration>();
        ranges.between(0, this.view.state.doc.length, (from, to, value) => {
          const context = contextById.get(value.contextId);
          if (!context) {
            return;
          }
          builder.add(
            from,
            to,
            Decoration.replace({
              widget: new TerminalContextWidget(context, currentConfig.onRemoveTerminalContext),
            }),
          );
        });
        return builder.finish();
      }
    },
    {
      decorations: (value) => value.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
    },
  );

  return [
    composerVimTerminalContextConfigFacet.of(config),
    composerVimTerminalContextField,
    widgetPlugin,
  ];
}

export function readComposerVimTerminalContextIds(state: EditorState): string[] {
  const ranges = state.field(composerVimTerminalContextField);
  const ids: string[] = [];
  ranges.between(0, state.doc.length, (_from, _to, value) => {
    ids.push(value.contextId);
  });
  return ids;
}
