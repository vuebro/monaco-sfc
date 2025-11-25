import type { WorkerLanguageService } from "@volar/monaco/worker";
import type Monaco from "monaco-editor-core";

import {
  activateAutoInsertion,
  activateMarkers,
  registerProviders,
} from "@volar/monaco";

export default async (monaco: typeof import("monaco-editor-core")) => {
  const getSyncUris = () => monaco.editor.getModels().map(({ uri }) => uri),
    id = "vue",
    languageId: string[] = [id, "javascript", "typescript", "markdown"],
    worker: Monaco.editor.MonacoWebWorker<WorkerLanguageService> =
      monaco.editor.createWebWorker({
        label: id,
        moduleId: "vs/language/vue/vueWorker",
      });
  monaco.languages.register({ extensions: [`.${id}`], id });
  activateMarkers(worker, languageId, id, getSyncUris, monaco.editor);
  activateAutoInsertion(worker, languageId, getSyncUris, monaco.editor);
  await registerProviders(worker, languageId, getSyncUris, monaco.languages);
};
