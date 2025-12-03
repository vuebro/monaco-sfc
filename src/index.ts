import type { WorkerLanguageService } from "@volar/monaco/worker";
import type Monaco from "monaco-editor-core";

import { shikiToMonaco } from "@shikijs/monaco";
import {
  activateAutoInsertion,
  activateMarkers,
  registerProviders,
} from "@volar/monaco";
import { createHighlighter } from "shiki";

export default async (monaco: typeof import("monaco-editor-core")) => {
  const getSyncUris = () => monaco.editor.getModels().map(({ uri }) => uri),
    langs = ["vue", "javascript", "typescript", "mdc", "markdown"],
    highlighter = await createHighlighter({
      langs,
      themes: ["vitesse-light", "vitesse-dark"],
    }),
    worker: Monaco.editor.MonacoWebWorker<WorkerLanguageService> =
      monaco.editor.createWebWorker({
        label: "vue",
        moduleId: "vs/language/vue/vueWorker",
      });

  monaco.languages.register({ id: "vue" });

  activateMarkers(worker, langs, "vue", getSyncUris, monaco.editor);
  activateAutoInsertion(worker, langs, getSyncUris, monaco.editor);
  shikiToMonaco(highlighter, monaco);
  await registerProviders(worker, langs, getSyncUris, monaco.languages);
};
