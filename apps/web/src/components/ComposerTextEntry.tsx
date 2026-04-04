import { forwardRef } from "react";

import { useSettings } from "~/hooks/useSettings";
import { ComposerPromptEditor } from "./ComposerPromptEditor";
import type { ComposerTextEntryProps } from "./ComposerTextEntry.types";
import { ComposerVimPromptEditor } from "./vim/ComposerVimPromptEditor";

export type { ComposerPromptEditorHandle } from "./ComposerPromptEditor";

export const ComposerTextEntry = forwardRef<
  import("./ComposerPromptEditor").ComposerPromptEditorHandle,
  ComposerTextEntryProps
>(function ComposerTextEntry(props, ref) {
  const composerVimModeEnabled = useSettings().composerVimModeEnabled;

  if (composerVimModeEnabled) {
    return <ComposerVimPromptEditor ref={ref} {...props} />;
  }

  return <ComposerPromptEditor ref={ref} {...props} />;
});
