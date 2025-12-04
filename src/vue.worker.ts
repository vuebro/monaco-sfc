import type { LanguageServicePlugin } from "@volar/monaco/worker";
import type { Language } from "@vue/language-service";
import type { worker } from "monaco-editor-core";

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
  vueCompilerOptions = getDefaultCompilerOptions(),
  globalTypes = generateGlobalTypes(vueCompilerOptions),
  globalTypesPath =
    "/node_modules/" + getGlobalTypesFileName(vueCompilerOptions),
  md = markdownit(),
  npmFileSystem = createNpmFileSystem(),
  semanticPlugin = createTypeScriptSemanticPlugin(typescript),
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
  );

const fs = {
  ...npmFileSystem,
  readFile: (uri: URI) =>
    uri.path === globalTypesPath ? globalTypes : npmFileSystem.readFile(uri),
  stat: (uri: URI) =>
    uri.path === globalTypesPath
      ? { ctime, mtime: ctime, size: globalTypes.length, type: 1 }
      : npmFileSystem.stat(uri),
};

vueCompilerOptions.vitePressExtensions.push(...[".md", ".mdc"]);
vueCompilerOptions.globalTypesPath = () => globalTypesPath;

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
        {
          ...semanticPlugin,
          create: (context) => {
            const pluginInstance = semanticPlugin.create(context),
              languageService =
                pluginInstance.provide["typescript/languageService"](),
              proxy = createVueLanguageServiceProxy(
                typescript,
                context.language as Language,
                languageService,
                vueCompilerOptions,
                asUri,
              ),
              vueLanguageService = {
                getCodeFixesAtPosition:
                  proxy.getCodeFixesAtPosition.bind(proxy),
                getCompletionEntryDetails:
                  proxy.getCompletionEntryDetails.bind(proxy),
                getCompletionsAtPosition:
                  proxy.getCompletionsAtPosition.bind(proxy),
                getDefinitionAndBoundSpan:
                  proxy.getDefinitionAndBoundSpan.bind(proxy),
                getQuickInfoAtPosition:
                  proxy.getQuickInfoAtPosition.bind(proxy),
              };
            pluginInstance.provide["typescript/languageService"] = () => ({
              ...languageService,
              ...vueLanguageService,
            });
            return pluginInstance;
          },
        },
        createTypeScriptDirectiveCommentPlugin(),
        ...(createVueLanguageServicePlugins(typescript, {
          collectExtractProps(fileName, templateCodeRange) {
            const {
              languageService: { context },
            } = workerLanguageService;
            const sourceScript = context.language.scripts.get(asUri(fileName));
            return sourceScript?.generated?.root instanceof VueVirtualCode
              ? collectExtractProps(
                  typescript,
                  context.language as Language,
                  context.inject("typescript/languageService").getProgram(),
                  sourceScript,
                  sourceScript.generated.root,
                  templateCodeRange,
                )
              : undefined;
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
            const {
              languageService: { context },
            } = workerLanguageService;
            const sourceScript = context.language.scripts.get(asUri(fileName));
            return sourceScript?.generated?.root instanceof VueVirtualCode
              ? getComponentSlots(
                  typescript,
                  context.inject("typescript/languageService").getProgram(),
                  sourceScript.generated.root,
                )
              : undefined;
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
          getQuickInfoAtPosition: async (fileName, position) => {
            const { contents } =
              (await workerLanguageService.languageService.getHover(
                asUri(fileName),
                position,
              )) ?? {};
            return (
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
              )
            );
          },
          isRefAtPosition(fileName, position) {
            const {
              languageService: { context },
            } = workerLanguageService;
            const sourceScript = context.language.scripts.get(asUri(fileName));
            return sourceScript?.generated?.root instanceof VueVirtualCode
              ? isRefAtPosition(
                  typescript,
                  workerLanguageService.languageService.context
                    .language as Language,
                  workerLanguageService.languageService.context
                    .inject("typescript/languageService")
                    .getProgram(),
                  sourceScript,
                  sourceScript.generated.root,
                  position,
                )
              : undefined;
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
