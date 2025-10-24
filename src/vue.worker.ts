import type { WorkerLanguageService, Language } from "@volar/monaco/worker";
import type { LanguageService } from "@vue/language-service";
import type { Provide } from "volar-service-typescript";
import type { worker } from "monaco-editor-core";

import {
  getDefaultCompilerOptions,
  createVueLanguagePlugin,
  getGlobalTypesFileName,
  generateGlobalTypes,
  VueVirtualCode,
} from "@vue/language-core";
import { create as createTypeScriptDirectiveCommentPlugin } from "volar-service-typescript/lib/plugins/directiveComment";
import { create as createTypeScriptSemanticPlugin } from "volar-service-typescript/lib/plugins/semantic";
import { getComponentDirectives } from "@vue/typescript-plugin/lib/requests/getComponentDirectives";
import { getComponentEvents } from "@vue/typescript-plugin/lib/requests/getComponentEvents";
import { getComponentNames } from "@vue/typescript-plugin/lib/requests/getComponentNames";
import { getComponentProps } from "@vue/typescript-plugin/lib/requests/getComponentProps";
import { getComponentSlots } from "@vue/typescript-plugin/lib/requests/getComponentSlots";
import { getElementAttrs } from "@vue/typescript-plugin/lib/requests/getElementAttrs";
import { getElementNames } from "@vue/typescript-plugin/lib/requests/getElementNames";
import { isRefAtPosition } from "@vue/typescript-plugin/lib/requests/isRefAtPosition";
import { createVueLanguageServiceProxy } from "@vue/typescript-plugin/lib/common";
import { createTypeScriptWorkerLanguageService } from "@volar/monaco/worker";
import { initialize } from "monaco-editor-core/esm/vs/editor/editor.worker";
import { createVueLanguageServicePlugins } from "@vue/language-service";
import typescript, { convertCompilerOptionsFromJson } from "typescript";
import { createNpmFileSystem } from "@volar/jsdelivr";
import { Window } from "@remote-dom/polyfill";
import { URI } from "vscode-uri";

/** Don't remove! It's prevent emoji errors. (Non-UTF characters in the code) */
Window.setGlobal(new Window());

const { options: compilerOptions } = convertCompilerOptionsFromJson(
    {
      allowImportingTsExtensions: true,
      moduleResolution: "Bundler",
      module: "ESNext",
      target: "ESNext",
      jsx: "Preserve",
      allowJs: true,
      checkJs: true,
    },
    "",
  ),
  vueCompilerOptions = getDefaultCompilerOptions(),
  globalTypesPath =
    "/node_modules/" + getGlobalTypesFileName(vueCompilerOptions),
  semanticPlugin = createTypeScriptSemanticPlugin(typescript),
  asFileName = ({ path }: { path: URI["path"] }) => path,
  globalTypes = generateGlobalTypes(vueCompilerOptions),
  asUri = (fileName: string) => URI.file(fileName),
  fs = createNpmFileSystem(),
  env = { workspaceFolders: [URI.file("/")], fs },
  // eslint-disable-next-line @typescript-eslint/unbound-method
  { create } = semanticPlugin,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  { readFile, stat } = fs,
  ctime = Date.now();

vueCompilerOptions.globalTypesPath = () => globalTypesPath;
fs.stat = async (uri) =>
  uri.path === globalTypesPath
    ? {
        size: globalTypes.length,
        ctime: ctime,
        mtime: ctime,
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
      new Proxy(
        {},
        {
          get(_target, prop, receiver) {
            return Reflect.get(context.language, prop, receiver) as unknown;
          },
        },
      ) as unknown as Language,
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
    const workerService = createTypeScriptWorkerLanguageService({
        languageServicePlugins: [
          semanticPlugin,
          createTypeScriptDirectiveCommentPlugin(),
          ...createVueLanguageServicePlugins(typescript, {
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
              const { sourceScript, virtualCode } = getVirtualCode(fileName),
                program = getProgram();
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
            getComponentSlots(fileName) {
              const { virtualCode } = getVirtualCode(fileName);
              const program = getProgram();
              return (
                program && getComponentSlots(typescript, program, virtualCode)
              );
            },
            getComponentEvents(fileName, tag) {
              const program = getProgram();
              return (
                program &&
                getComponentEvents(typescript, program, fileName, tag)
              );
            },
            getComponentDirectives(fileName) {
              const program = getProgram();
              return (
                program && getComponentDirectives(typescript, program, fileName)
              );
            },
            getComponentProps(fileName, tag) {
              const program = getProgram();
              return (
                program && getComponentProps(typescript, program, fileName, tag)
              );
            },
            getElementAttrs(fileName, tag) {
              const program = getProgram();
              return (
                program && getElementAttrs(typescript, program, fileName, tag)
              );
            },
            getComponentNames(fileName) {
              const program = getProgram();
              return (
                program && getComponentNames(typescript, program, fileName)
              );
            },
            getElementNames(fileName) {
              const program = getProgram();
              return program && getElementNames(typescript, program, fileName);
            },
            getEncodedSemanticClassifications() {
              throw new Error("Not implemented");
            },
            getDocumentHighlights() {
              throw new Error("Not implemented");
            },
            getImportPathForFile() {
              throw new Error("Not implemented");
            },
            collectExtractProps() {
              throw new Error("Not implemented");
            },
          }).filter(
            (plugin) =>
              ![
                "typescript-semantic-tokens",
                "vue-document-highlights",
                "vue-document-drop",
                "vue-extract-file",
              ].includes(plugin.name ?? ""),
          ),
        ],
        languagePlugins: [
          createVueLanguagePlugin(
            typescript,
            compilerOptions,
            vueCompilerOptions,
            asFileName,
          ),
        ],
        uriConverter: { asFileName, asUri },
        compilerOptions,
        workerContext,
        typescript,
        env,
      }),
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
      getProgram = () => getTypescriptLanguageService().getProgram();

    return workerService;

    /**
     * Retrieves the language service instance
     *
     * @returns {LanguageService} The Vue language service instance that
     *   provides syntax analysis, code completion, and other features
     * @throws {Error} May throw an error when unable to access the internal
     *   language service
     */
    function getLanguageService() {
      //@ts-expect-error Property 'languageService' is private and only accessible within class 'WorkerLanguageService'.
      return workerService.languageService as LanguageService;
    }
  });
};
