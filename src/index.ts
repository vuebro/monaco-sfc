import type { WorkerLanguageService } from "@volar/monaco/worker";
import type Monaco from "monaco-editor-core";

import {
  activateAutoInsertion,
  activateMarkers,
  registerProviders,
} from "@volar/monaco";

import * as languageConfigs from "./language-configs";

export default (monaco: typeof import("monaco-editor-core")) => {
  const getSyncUris = () => monaco.editor.getModels().map(({ uri }) => uri),
    id = "vue",
    languageId: string[] = [],
    worker: Monaco.editor.MonacoWebWorker<WorkerLanguageService> =
      monaco.editor.createWebWorker({
        label: id,
        moduleId: "vs/language/vue/vueWorker",
      });

  monaco.languages.register({ aliases: [id], extensions: [`.${id}`], id });

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
