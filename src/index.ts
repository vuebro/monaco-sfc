import type { WorkerLanguageService } from "@volar/monaco/worker";
import type Monaco from "monaco-editor-core";

import {
  activateAutoInsertion,
  registerProviders,
  activateMarkers,
} from "@volar/monaco";

import * as languageConfigs from "./language-configs";

export default (monaco: typeof import("monaco-editor-core")) => {
  const id = "vue",
    worker: Monaco.editor.MonacoWebWorker<WorkerLanguageService> =
      monaco.editor.createWebWorker({
        moduleId: "vs/language/vue/vueWorker",
        label: id,
      }),
    getSyncUris = () => monaco.editor.getModels().map(({ uri }) => uri),
    languageId: string[] = [];

  monaco.languages.register({ extensions: [`.${id}`], aliases: [id], id });

  const languages = monaco.languages.getLanguages();

  Object.entries(languageConfigs).forEach(
    ([alias, configuration]: [
      string,
      Monaco.languages.LanguageConfiguration,
    ]) => {
      const { id } =
        languages.find(({ aliases }) => aliases?.includes(alias)) ?? {};
      if (id) {
        languageId.push(id);
        monaco.languages.setLanguageConfiguration(id, configuration);
      }
    },
  );

  void registerProviders(worker, languageId, getSyncUris, monaco.languages);
  activateMarkers(worker, languageId, id, getSyncUris, monaco.editor);
  activateAutoInsertion(worker, languageId, getSyncUris, monaco.editor);
};
