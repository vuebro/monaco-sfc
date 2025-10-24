# @vuebro/monaco-sfc Project Context

## Project Overview

**@vuebro/monaco-sfc** is a library that provides Vue Single File Component (SFC) language support for the Monaco Editor. It enables rich editing experiences with syntax highlighting, IntelliSense, error detection, and more for Vue SFCs within the Monaco Editor environment.

### Key Features

- Vue SFC (Single File Component) support with syntax highlighting for Vue, HTML, CSS, JavaScript, and TypeScript
- IntelliSense and auto-completion for Vue templates and scripts
- Error detection and linting via integrated language services
- Auto-closing of tags and brackets
- Folding support for regions
- Proper indentation and formatting rules
- Integration with Monaco Editor's web worker system

### Core Architecture

The project consists of two main files:

1. **`src/index.ts`** - The main initialization module that:
   - Registers the 'vue' language with Monaco
   - Sets up language configurations for embedded languages (CSS, JS, TS, Vue)
   - Creates a web worker for language service operations
   - Activates features like auto-insertion, markers, and syntax providers

2. **`src/vue.worker.ts`** - The web worker implementation that:
   - Initializes the Vue language service using @volar/monaco
   - Sets up TypeScript compilation and Vue-specific compiler options
   - Handles language service operations in a separate thread
   - Provides Vue-specific language features like component detection, directive analysis, etc.

### Dependencies

The package relies on several key libraries:

- `@volar/monaco` - Vue Language Server integration for Monaco
- `@vue/language-core` - Vue Language Service core
- `@vue/language-service` - Vue Language Service
- `@vue/typescript-plugin` - TypeScript plugin for Vue
- `monaco-editor-core` - The Monaco Editor
- `vscode-uri` - URI handling for VS Code compatibility
- `@remote-dom/polyfill` - For handling non-UTF characters
- `@volar/jsdelivr` - File system implementation

## Building and Running

### Build Process

- Build command: `npm run build` (executes `tsc && vite build`)
- The build process compiles TypeScript source files and uses Vite to bundle the web worker
- Output is generated in the `dist` directory

### Development Setup

1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Run linting: `npm run lint`

### Configuration Files

- `tsconfig.json` - Extends `@vuebro/configs/tsconfig` for TypeScript compilation
- `vite.config.ts` - Configures Vite build, specifically sets up the Vue web worker as a library output
- `eslint.config.ts` - Uses shared ESLint configuration from `@vuebro/configs/eslint`
- `package.json` - Defines package metadata, dependencies, and build scripts

### Output Structure

The package exports:

- Main entry point: `dist/index.js`
- Web worker: `dist/vue.worker.js` (built specifically for Monaco's web worker system)

## Development Conventions

### Code Style

- TypeScript with ES modules
- Follows @vuebro/configs conventions for formatting and linting
- Uses Monaco Editor's type definitions (monaco-editor-core)

### Architecture Pattern

- Separation of main thread initialization (index.ts) and web worker processing (vue.worker.ts)
- Integration with Volar's language service architecture
- Proper URI handling using vscode-uri for compatibility with VS Code language services

### Testing

- No explicit test framework configuration visible in the project
- Testing would likely involve integration tests with Monaco Editor

## Usage Example

```javascript
import initMonacoSFC from "@vuebro/monaco-sfc";

// Initialize with your Monaco instance
initMonacoSFC(monaco);

// Now you can create Vue SFC editors
const editor = monaco.editor.create(document.getElementById("container"), {
  value: "<template>\n  <div>Hello Vue in Monaco!</div>\n</template>",
  language: "vue",
});
```

## Important Notes

- The project uses a web worker architecture to prevent blocking the main thread during language processing
- It leverages the Volar ecosystem for Vue-specific language features
- The license is AGPL-3.0-only, which requires derivative works to be distributed under the same license
- The `Window.setGlobal(new Window())` call in `vue.worker.ts` prevents emoji/UTF character errors in the code
