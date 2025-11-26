import type {
  LanguageServicePlugin,
  WorkerLanguageService,
} from "@volar/monaco/worker";
import type { Language, LanguageService } from "@vue/language-service";
import type { worker } from "monaco-editor-core";
import type { Provide } from "volar-service-typescript";

import { Window } from "@remote-dom/polyfill";
import { createNpmFileSystem } from "@volar/jsdelivr";
import { createTypeScriptWorkerLanguageService } from "@volar/monaco/worker";
import {
  createVueLanguagePlugin,
  generateGlobalTypes,
  getDefaultCompilerOptions,
  getGlobalTypesFileName,
  VueVirtualCode,
} from "@vue/language-core";
import { createVueLanguageServicePlugins } from "@vue/language-service";
import { createVueLanguageServiceProxy } from "@vue/typescript-plugin/lib/common";
import { getComponentDirectives } from "@vue/typescript-plugin/lib/requests/getComponentDirectives";
import { getComponentEvents } from "@vue/typescript-plugin/lib/requests/getComponentEvents";
import { getComponentNames } from "@vue/typescript-plugin/lib/requests/getComponentNames";
import { getComponentProps } from "@vue/typescript-plugin/lib/requests/getComponentProps";
import { getComponentSlots } from "@vue/typescript-plugin/lib/requests/getComponentSlots";
import { getElementAttrs } from "@vue/typescript-plugin/lib/requests/getElementAttrs";
import { getElementNames } from "@vue/typescript-plugin/lib/requests/getElementNames";
import { isRefAtPosition } from "@vue/typescript-plugin/lib/requests/isRefAtPosition";
import { initialize } from "monaco-editor-core/esm/vs/editor/editor.worker";
import typescript, { convertCompilerOptionsFromJson } from "typescript";
import { create as createTypeScriptDirectiveCommentPlugin } from "volar-service-typescript/lib/plugins/directiveComment";
import { create as createTypeScriptSemanticPlugin } from "volar-service-typescript/lib/plugins/semantic";
import { URI } from "vscode-uri";

/** Don't remove! It's prevent emoji errors. (Non-UTF characters in the code) */
Window.setGlobal(new Window());

const asFileName = ({ path }: { path: URI["path"] }) => path,
  asUri = (fileName: string) => URI.file(fileName),
  ctime = Date.now(),
  fs = createNpmFileSystem(),
  env = { fs, workspaceFolders: [URI.file("/")] },
  vueCompilerOptions = getDefaultCompilerOptions(),
  globalTypes = generateGlobalTypes(vueCompilerOptions),
  globalTypesPath =
    "/node_modules/" + getGlobalTypesFileName(vueCompilerOptions),
  semanticPlugin = createTypeScriptSemanticPlugin(typescript),
  // eslint-disable-next-line @typescript-eslint/unbound-method
  { create } = semanticPlugin,
  { options: compilerOptions } = convertCompilerOptionsFromJson(
    {
      allowImportingTsExtensions: true,
      allowJs: true,
      checkJs: true,
      jsx: "Preserve",
      module: "ESNext",
      moduleResolution: "Bundler",
      target: "ESNext",
    },
    "",
  ),
  // eslint-disable-next-line @typescript-eslint/unbound-method
  { readFile, stat } = fs;

vueCompilerOptions.globalTypesPath = () => globalTypesPath;
fs.stat = async (uri) =>
  uri.path === globalTypesPath
    ? {
        ctime: ctime,
        mtime: ctime,
        size: globalTypes.length,
        type: 1,
      }
    : stat(uri);
fs.readFile = async (uri) =>
  uri.path === globalTypesPath ? globalTypes : readFile(uri);
semanticPlugin.create = (context) => {
  const created = create(context),
    ls = (created.provide as Provide)["typescript/languageService"](),
    proxy = createVueLanguageServiceProxy(
      typescript,
      new Proxy({} as Language<URI>, {
        get(_target, prop, receiver) {
          return Reflect.get(context.language, prop, receiver) as unknown;
        },
      }),
      ls,
      vueCompilerOptions,
      asUri,
    );
  // eslint-disable-next-line @typescript-eslint/unbound-method
  ls.getCompletionsAtPosition = proxy.getCompletionsAtPosition;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  ls.getCompletionEntryDetails = proxy.getCompletionEntryDetails;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  ls.getCodeFixesAtPosition = proxy.getCodeFixesAtPosition;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  ls.getDefinitionAndBoundSpan = proxy.getDefinitionAndBoundSpan;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  ls.getQuickInfoAtPosition = proxy.getQuickInfoAtPosition;
  return created;
};

self.onmessage = () => {
  (
    initialize as (
      foreignModule: (
        workerContext: worker.IWorkerContext,
      ) => WorkerLanguageService,
    ) => void
  )((workerContext) => {
    const getTypescriptLanguageService = () =>
      getLanguageService().context.inject(
        "typescript/languageService",
      ) as typescript.LanguageService;
    const getProgram = () => getTypescriptLanguageService().getProgram(),
      getVirtualCode = (fileName: string) => {
        const sourceScript = getLanguageService().context.language.scripts.get(
          asUri(fileName),
        );
        if (!sourceScript)
          throw new Error("No source script found for file: " + fileName);
        const virtualCode = sourceScript.generated?.root;
        if (!(virtualCode instanceof VueVirtualCode))
          throw new Error("No virtual code found for file: " + fileName);
        return {
          sourceScript,
          virtualCode,
        };
      },
      workerService = createTypeScriptWorkerLanguageService({
        compilerOptions,
        env,
        languagePlugins: [
          createVueLanguagePlugin(
            typescript,
            compilerOptions,
            vueCompilerOptions,
            asFileName,
          ),
        ],
        languageServicePlugins: [
          semanticPlugin,
          createTypeScriptDirectiveCommentPlugin(),
          ...(createVueLanguageServicePlugins(typescript, {
            collectExtractProps() {
              throw new Error("Not implemented");
            },
            getComponentDirectives(fileName) {
              const program = getProgram();
              return (
                program && getComponentDirectives(typescript, program, fileName)
              );
            },
            getComponentEvents(fileName, tag) {
              const program = getProgram();
              return (
                program &&
                getComponentEvents(typescript, program, fileName, tag)
              );
            },
            getComponentNames(fileName) {
              const program = getProgram();
              return (
                program && getComponentNames(typescript, program, fileName)
              );
            },
            getComponentProps(fileName, tag) {
              const program = getProgram();
              return (
                program && getComponentProps(typescript, program, fileName, tag)
              );
            },
            getComponentSlots(fileName) {
              const { virtualCode } = getVirtualCode(fileName);
              const program = getProgram();
              return (
                program && getComponentSlots(typescript, program, virtualCode)
              );
            },
            getDocumentHighlights() {
              throw new Error("Not implemented");
            },
            getElementAttrs(_fileName, tag) {
              const program = getProgram();
              return program && getElementAttrs(typescript, program, tag);
            },
            getElementNames() {
              const program = getProgram();
              return program && getElementNames(typescript, program);
            },
            getEncodedSemanticClassifications() {
              throw new Error("Not implemented");
            },
            getImportPathForFile() {
              throw new Error("Not implemented");
            },
            async getQuickInfoAtPosition(fileName, position) {
              const uri = asUri(fileName);
              const sourceScript =
                getLanguageService().context.language.scripts.get(uri);
              if (!sourceScript) return;
              const hover = await getLanguageService().getHover(uri, position);
              let text = "";
              if (typeof hover?.contents === "string") text = hover.contents;
              else if (Array.isArray(hover?.contents))
                text = hover.contents
                  .map((c) => (typeof c === "string" ? c : c.value))
                  .join("\n");
              else if (hover) text = hover.contents.value;
              text = text
                .replace(/```typescript/g, "")
                .replace(/```/g, "")
                .replace(/---/g, "")
                .trim();
              let newText = text;
              do {
                text = newText;
                newText = text.replace(/\n\n/g, "\n");
              } while (newText !== text);
              text = text.replace(/\n/g, " | ");
              return text;
            },
            isRefAtPosition(fileName, position) {
              const program = getProgram(),
                { sourceScript, virtualCode } = getVirtualCode(fileName);
              return (
                program &&
                isRefAtPosition(
                  typescript,
                  getLanguageService().context.language,
                  program,
                  sourceScript,
                  virtualCode,
                  position,
                )
              );
            },
          }).filter(
            (plugin) =>
              ![
                "typescript-semantic-tokens",
                "vue-document-drop",
                "vue-document-highlights",
                "vue-extract-file",
              ].includes(plugin.name ?? ""),
          ) as unknown as LanguageServicePlugin[]),
        ],
        typescript,
        uriConverter: { asFileName, asUri },
        workerContext,
      });

    return workerService;

    /**
     * Gets the language service
     *
     * @returns The language service
     */
    function getLanguageService() {
      return workerService.languageService as LanguageService;
    }
  });
};
