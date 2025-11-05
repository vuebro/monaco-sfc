import type { Language, WorkerLanguageService } from "@volar/monaco/worker";
import type { LanguageService } from "@vue/language-service";
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

/**
 * Converts a URI object to a file name
 *
 * @param param0 - The URI object
 * @param param0.path - The path property of the URI
 * @returns The file name extracted from the path
 */
const asFileName = ({ path }: { path: URI["path"] }) => path,
  /**
   * Converts a file name to a URI
   *
   * @param fileName - The file name to convert
   * @returns The URI object created from the file name
   */
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

/**
 * Sets the global types path for Vue compiler options
 *
 * @returns The global types path
 */
vueCompilerOptions.globalTypesPath = () => globalTypesPath;
/**
 * Stats a file URI
 *
 * @param uri - The URI to stat
 * @returns A promise that resolves to the stat result
 */
fs.stat = async (uri) =>
  uri.path === globalTypesPath
    ? {
        ctime: ctime,
        mtime: ctime,
        size: globalTypes.length,
        type: 1,
      }
    : stat(uri);
/**
 * Reads a file URI
 *
 * @param uri - The URI to read
 * @returns A promise that resolves to the file content
 */
fs.readFile = async (uri) =>
  uri.path === globalTypesPath ? globalTypes : readFile(uri);
/**
 * Creates a TypeScript semantic plugin with Vue support
 *
 * @param context - The plugin context
 * @returns The created plugin
 */
semanticPlugin.create = (context) => {
  const created = create(context),
    ls = (created.provide as Provide)["typescript/languageService"](),
    proxy = createVueLanguageServiceProxy(
      typescript,
      new Proxy(
        {},
        {
          /**
           * Gets a property from the target
           *
           * @param _target - The target object
           * @param prop - The property name
           * @param receiver - The receiver object
           * @returns The property value
           */
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

/**
 * Handles messages sent to the worker
 */
self.onmessage = () => {
  (
    initialize as (
      foreignModule: (
        workerContext: worker.IWorkerContext,
      ) => WorkerLanguageService,
    ) => void
  )((workerContext) => {
    /**
     * Gets the TypeScript language service
     *
     * @returns The TypeScript language service
     */
    const getTypescriptLanguageService = () =>
      getLanguageService().context.inject(
        "typescript/languageService",
      ) as typescript.LanguageService;
    /**
     * Gets the TypeScript program
     *
     * @returns The TypeScript program
     */
    const getProgram = () => getTypescriptLanguageService().getProgram(),
      /**
       * Gets the virtual code representation of a file
       *
       * @param fileName - The name of the file
       * @returns Object containing the source script and virtual code
       * @throws {Error} If no source script or virtual code is found
       */
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
          ...createVueLanguageServicePlugins(typescript, {
            /**
             * Collects extract props (not implemented)
             *
             * @throws {Error} Always throws as this function is not implemented
             */
            collectExtractProps() {
              throw new Error("Not implemented");
            },
            /**
             * Gets component directives for a file
             *
             * @param fileName - The name of the file
             * @returns Component directives or undefined
             */
            getComponentDirectives(fileName) {
              const program = getProgram();
              return (
                program && getComponentDirectives(typescript, program, fileName)
              );
            },
            /**
             * Gets component events for a file and tag
             *
             * @param fileName - The name of the file
             * @param tag - The tag name
             * @returns Component events or undefined
             */
            getComponentEvents(fileName, tag) {
              const program = getProgram();
              return (
                program &&
                getComponentEvents(typescript, program, fileName, tag)
              );
            },
            /**
             * Gets component names for a file
             *
             * @param fileName - The name of the file
             * @returns Component names or undefined
             */
            getComponentNames(fileName) {
              const program = getProgram();
              return (
                program && getComponentNames(typescript, program, fileName)
              );
            },
            /**
             * Gets component props for a file and tag
             *
             * @param fileName - The name of the file
             * @param tag - The tag name
             * @returns Component props or undefined
             */
            getComponentProps(fileName, tag) {
              const program = getProgram();
              return (
                program && getComponentProps(typescript, program, fileName, tag)
              );
            },
            /**
             * Gets component slots for a file
             *
             * @param fileName - The name of the file
             * @returns Component slots or undefined
             */
            getComponentSlots(fileName) {
              const { virtualCode } = getVirtualCode(fileName);
              const program = getProgram();
              return (
                program && getComponentSlots(typescript, program, virtualCode)
              );
            },
            /**
             * Gets document highlights (not implemented)
             *
             * @throws {Error} Always throws as this function is not implemented
             */
            getDocumentHighlights() {
              throw new Error("Not implemented");
            },
            /**
             * Gets element attributes for a file and tag
             *
             * @param _fileName - The name of the file
             * @param tag - The tag name
             * @returns Element attributes or undefined
             */
            getElementAttrs(_fileName, tag) {
              const program = getProgram();
              return program && getElementAttrs(typescript, program, tag);
            },
            /**
             * Gets element names for a file
             *
             * @returns Element names or undefined
             */
            getElementNames() {
              const program = getProgram();
              return program && getElementNames(typescript, program);
            },
            /**
             * Gets encoded semantic classifications (not implemented)
             *
             * @throws {Error} Always throws as this function is not implemented
             */
            getEncodedSemanticClassifications() {
              throw new Error("Not implemented");
            },
            /**
             * Gets import path for a file (not implemented)
             *
             * @throws {Error} Always throws as this function is not implemented
             */
            getImportPathForFile() {
              throw new Error("Not implemented");
            },
            /**
             * Gets quick info at a specific position
             *
             * @param fileName - The name of the file
             * @param position - The position in the file
             * @returns A promise that resolves to the quick info text
             */
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
            /**
             * Checks if there's a ref at a specific position
             *
             * @param fileName - The name of the file
             * @param position - The position in the file
             * @returns Result of the ref check or undefined
             */
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
          ),
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
      //@ts-expect-error Property 'languageService' is private and only accessible within class 'WorkerLanguageService'.
      return workerService.languageService as LanguageService;
    }
  });
};
