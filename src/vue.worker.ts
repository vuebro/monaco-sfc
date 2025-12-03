import type { LanguageServicePlugin } from "@volar/monaco/worker";
import type { SourceScript } from "@vue/language-core";
import type { Language, LanguageService } from "@vue/language-service";
import type { worker } from "monaco-editor-core";
import type { Hover } from "vscode-languageserver-protocol";

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
import { collectExtractProps } from "@vue/typescript-plugin/lib/requests/collectExtractProps";
import { getComponentDirectives } from "@vue/typescript-plugin/lib/requests/getComponentDirectives";
import { getComponentEvents } from "@vue/typescript-plugin/lib/requests/getComponentEvents";
import { getComponentNames } from "@vue/typescript-plugin/lib/requests/getComponentNames";
import { getComponentProps } from "@vue/typescript-plugin/lib/requests/getComponentProps";
import { getComponentSlots } from "@vue/typescript-plugin/lib/requests/getComponentSlots";
import { getElementAttrs } from "@vue/typescript-plugin/lib/requests/getElementAttrs";
import { getElementNames } from "@vue/typescript-plugin/lib/requests/getElementNames";
import { getImportPathForFile } from "@vue/typescript-plugin/lib/requests/getImportPathForFile";
import { isRefAtPosition } from "@vue/typescript-plugin/lib/requests/isRefAtPosition";
import { resolveModuleName } from "@vue/typescript-plugin/lib/requests/resolveModuleName";
import markdownit from "markdown-it";
import { initialize } from "monaco-editor-core/esm/vs/editor/editor.worker";
import typescript, { convertCompilerOptionsFromJson } from "typescript";
import { create as createTypeScriptDirectiveCommentPlugin } from "volar-service-typescript/lib/plugins/directiveComment";
import { create as createTypeScriptSemanticPlugin } from "volar-service-typescript/lib/plugins/semantic";
import { MarkupContent } from "vscode-languageserver-protocol";
import { URI } from "vscode-uri";

/** Don't remove! It's prevent emoji errors. (Non-UTF characters in the code) */
Window.setGlobal(new Window());

const asFileName = ({ path }: { path: URI["path"] }) => path,
  asUri = (fileName: string) => URI.file(fileName),
  ctime = Date.now(),
  fs = createNpmFileSystem(),
  getVirtualCode = (sourceScript: SourceScript<URI> | undefined) =>
    sourceScript?.generated?.root instanceof VueVirtualCode
      ? sourceScript.generated.root
      : undefined,
  vueCompilerOptions = getDefaultCompilerOptions(),
  globalTypes = generateGlobalTypes(vueCompilerOptions),
  globalTypesPath =
    "/node_modules/" + getGlobalTypesFileName(vueCompilerOptions),
  md = markdownit(),
  mdHover = (contents: Hover["contents"] | undefined) =>
    contents &&
    md.render(
      MarkupContent.is(contents)
        ? contents.value
        : (Array.isArray(contents) ? contents : [contents])
            .map((markedString) =>
              typeof markedString === "string"
                ? markedString
                : `\`\`\`${markedString.language}\n${markedString.value}\n\`\`\``,
            )
            .join("\n"),
    ),
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

vueCompilerOptions.vitePressExtensions.push(".md");
vueCompilerOptions.globalTypesPath = () => globalTypesPath;

fs.stat = async (uri) =>
  uri.path === globalTypesPath
    ? { ctime, mtime: ctime, size: globalTypes.length, type: 1 }
    : stat(uri);
fs.readFile = async (uri) =>
  uri.path === globalTypesPath ? globalTypes : readFile(uri);

semanticPlugin.create = (context) => {
  const created = create(context),
    ls = created.provide["typescript/languageService"](),
    proxy = createVueLanguageServiceProxy(
      typescript,
      new Proxy({} as Language<URI>, {
        get(_target, prop, receiver) {
          return Reflect.get(context.language, prop, receiver);
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
  initialize((workerContext: worker.IWorkerContext) => {
    const workerLanguageService = createTypeScriptWorkerLanguageService({
      compilerOptions,
      env: { fs, workspaceFolders: [URI.file("/")] },
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
          collectExtractProps(fileName, templateCodeRange) {
            const sourceScript =
                workerLanguageService.languageService.context.language.scripts.get(
                  asUri(fileName),
                ),
              virtualCode = getVirtualCode(sourceScript);
            return (
              sourceScript &&
              virtualCode &&
              collectExtractProps(
                typescript,
                (workerLanguageService.languageService as LanguageService)
                  .context.language,
                workerLanguageService.languageService.context
                  .inject("typescript/languageService")
                  .getProgram(),
                sourceScript,
                virtualCode,
                templateCodeRange,
              )
            );
          },
          getComponentDirectives: (fileName) =>
            getComponentDirectives(
              typescript,
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
              fileName,
            ),
          getComponentEvents: (fileName, tag) =>
            getComponentEvents(
              typescript,
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
              fileName,
              tag,
            ),
          getComponentNames: (fileName) =>
            getComponentNames(
              typescript,
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
              fileName,
            ),
          getComponentProps: (fileName, tag) =>
            getComponentProps(
              typescript,
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
              fileName,
              tag,
            ),
          getComponentSlots(fileName) {
            const virtualCode = getVirtualCode(
              workerLanguageService.languageService.context.language.scripts.get(
                asUri(fileName),
              ),
            );
            return (
              virtualCode &&
              getComponentSlots(
                typescript,
                workerLanguageService.languageService.context
                  .inject("typescript/languageService")
                  .getProgram(),
                virtualCode,
              )
            );
          },
          getDocumentHighlights: () => undefined,
          getElementAttrs: (_fileName, tag) =>
            getElementAttrs(
              typescript,
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
              tag,
            ),
          getElementNames: () =>
            getElementNames(
              typescript,
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
            ),
          getEncodedSemanticClassifications: () => undefined,
          getImportPathForFile: (fileName, incomingFileName, preferences) =>
            getImportPathForFile(
              typescript,
              workerLanguageService.languageService.context.inject(
                "typescript/languageServiceHost",
              ),
              workerLanguageService.languageService.context
                .inject("typescript/languageService")
                .getProgram(),
              fileName,
              incomingFileName,
              preferences,
            ),
          getQuickInfoAtPosition: async (fileName, position) =>
            mdHover(
              (
                await workerLanguageService.languageService.getHover(
                  asUri(fileName),
                  position,
                )
              )?.contents,
            ),
          isRefAtPosition(fileName, position) {
            const sourceScript =
                workerLanguageService.languageService.context.language.scripts.get(
                  asUri(fileName),
                ),
              virtualCode = getVirtualCode(sourceScript);
            return (
              sourceScript &&
              virtualCode &&
              isRefAtPosition(
                typescript,
                (workerLanguageService.languageService as LanguageService)
                  .context.language,
                workerLanguageService.languageService.context
                  .inject("typescript/languageService")
                  .getProgram(),
                sourceScript,
                virtualCode,
                position,
              )
            );
          },
          resolveModuleName: (fileName, moduleName) =>
            resolveModuleName(
              typescript,
              workerLanguageService.languageService.context.inject(
                "typescript/languageServiceHost",
              ),
              fileName,
              moduleName,
            ),
        }).filter(
          ({ name }) => !name?.startsWith("vue-template"),
        ) as LanguageServicePlugin[]),
      ],
      typescript,
      uriConverter: { asFileName, asUri },
      workerContext,
    });
    return workerLanguageService;
  });
};
