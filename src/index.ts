import type { WorkerLanguageService } from "@volar/monaco/worker";
import type Monaco from "monaco-editor-core";

import { foldingProvider, formatter, language } from "@nuxtlabs/monarch-mdc";
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
    tabSize = 2,
    worker: Monaco.editor.MonacoWebWorker<WorkerLanguageService> =
      monaco.editor.createWebWorker({
        label: "vue",
        moduleId: "vs/language/vue/vueWorker",
      });

  monaco.languages.register({ extensions: [".vue"], id: "vue" });
  monaco.languages.register({ extensions: [".mdc"], id: "mdc" });
  monaco.languages.setMonarchTokensProvider("mdc", language);
  monaco.languages.registerDocumentFormattingEditProvider("mdc", {
    provideDocumentFormattingEdits: (model) => [
      {
        range: model.getFullModelRange(),
        text: formatter(model.getValue(), { tabSize }),
      },
    ],
  });
  monaco.languages.registerOnTypeFormattingEditProvider("mdc", {
    autoFormatTriggerCharacters: ["\n"],
    provideOnTypeFormattingEdits: (model, position) =>
      model
        .getLineContent(position.lineNumber - 1)
        .trim()
        .endsWith("---")
        ? []
        : [
            {
              range: model.getFullModelRange(),
              text: formatter(model.getValue(), {
                isFormatOnType: true,
                tabSize,
              }),
            },
          ],
  });
  monaco.languages.registerFoldingRangeProvider("mdc", {
    provideFoldingRanges: (model) => foldingProvider(model),
  });
  void registerProviders(worker, langs, getSyncUris, monaco.languages);
  activateMarkers(worker, langs, "vue", getSyncUris, monaco.editor);
  activateAutoInsertion(worker, langs, getSyncUris, monaco.editor);
  shikiToMonaco(highlighter, monaco);
};
