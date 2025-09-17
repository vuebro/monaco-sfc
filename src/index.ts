import type { WorkerLanguageService } from "@volar/monaco/worker";
import type Monaco from "monaco-editor";

import {
  activateAutoInsertion,
  activateMarkers,
  registerProviders,
} from "@volar/monaco";

import * as languageConfigs from "./language-configs";

export function configureMonacoTailwindcss(
  monaco: typeof import("monaco-editor"),
) {
  const getSyncUris = () => monaco.editor.getModels().map(({ uri }) => uri),
    id = "vue",
    worker: Monaco.editor.MonacoWebWorker<WorkerLanguageService> =
      monaco.editor.createWebWorker({
        label: id,
        moduleId: "vs/language/vue/vueWorker",
      });

  monaco.languages.register({
    aliases: [id],
    extensions: [`.${id}`],
    id,
  });
  monaco.languages.setLanguageConfiguration(id, languageConfigs.vue);

  void registerProviders(worker, [id], getSyncUris, monaco.languages);
  activateMarkers(worker, [id], id, getSyncUris, monaco.editor);
  activateAutoInsertion(worker, [id], getSyncUris, monaco.editor);
}
