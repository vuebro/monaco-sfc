# QWEN.md - @vuebro/monaco-sfc Context

## Project Overview

**@vuebro/monaco-sfc** is a Monaco Editor language server for Vue Single File Components (SFC). This library provides Vue language support for the Monaco editor, offering rich editing experiences with syntax highlighting, IntelliSense, error detection, and more for Vue SFCs.

### Key Features
- Vue SFC (Single File Component) support
- Syntax highlighting for Vue, HTML, CSS, JavaScript, and TypeScript
- IntelliSense and auto-completion for Vue templates and scripts
- Error detection and linting
- Auto-closing of tags and brackets
- Folding support for regions
- Proper indentation and formatting rules
- Integration with Monaco Editor's web worker system

### Architecture
The project is built on top of several core dependencies:
- `@volar/monaco` - Vue Language Server integration for Monaco
- `@vue/language-core` - Vue Language Service core
- `@vue/language-service` - Vue Language Service
- `monaco-editor-core` - The Monaco Editor
- `vscode-uri` - URI handling for VS Code compatibility

The implementation follows a pattern that separates the main Monaco editor integration logic from the web worker that handles the language service operations. This ensures that heavy language processing doesn't block the main UI thread.

## Source Code Structure

```
src/
├── env.d.ts          # Type definitions for Monaco Editor worker
├── index.ts          # Main entry point that integrates Vue support with Monaco
├── language-configs.ts # Language configuration for Vue and embedded languages
└── vue.worker.ts     # Web worker implementation for Vue language services
```

### Key Files:

1. **src/index.ts** - The main entry point that:
   - Registers the 'vue' language with Monaco
   - Configures language settings using language-configs.ts
   - Creates and activates the web worker for language services
   - Sets up auto-insertion, markers, and syntax providers

2. **src/vue.worker.ts** - The web worker implementation that:
   - Handles Vue-specific language service operations
   - Integrates with TypeScript language service using Vue plugins
   - Provides Vue component analysis features like component names, props, events, slots
   - Manages virtual code generation for Vue SFCs

3. **src/language-configs.ts** - Provides language configuration for:
   - CSS, Vue, JavaScript, and TypeScript languages
   - Includes bracket pairs, auto-closing pairs, indentation rules, comment syntax
   - Folding rules and on-enter rules for proper formatting

## Building and Running

### Prerequisites
- Node.js (version compatible with the dependencies)
- npm or yarn package manager

### Installation
```bash
npm install
```

### Build Commands
```bash
# Build the project (transpiles TypeScript and bundles using Vite)
npm run build

# Lint the code
npm run lint
```

The build process uses:
- TypeScript for type checking and compilation
- Vite for bundling with a specific configuration for the web worker
- The build outputs are placed in the `dist/` directory

## Development Conventions

### Code Style
- The project uses ESLint for code linting with a shared configuration from `@vuebro/configs`
- TypeScript is used throughout the project for type safety
- The code follows a functional approach with clear separation of concerns
- Functions are well-documented with JSDoc-style comments

### Testing
- No specific test files are visible in the source directory, suggesting tests might be in a separate location or the project follows a different testing approach
- The package relies heavily on integration with Vue language tools, so testing would involve ensuring proper integration with the Vue language server

### Web Worker Pattern
- The project implements the Monaco web worker pattern to avoid blocking the main thread
- The worker handles all language service operations while the main thread handles UI updates
- Communication between the worker and main thread is handled by the `@volar/monaco` utilities

## Key Implementation Details

1. **Vue Language Configuration**: The language-configs.ts file provides comprehensive configuration for Vue syntax including template, script, and style tag handling with proper auto-closing and indentation rules.

2. **Virtual Code Generation**: The system creates virtual code representations for Vue SFCs, allowing the TypeScript language service to understand Vue-specific syntax and provide appropriate IntelliSense.

3. **Component Analysis**: The worker provides Vue component analysis features including component names, props, events, and slots detection.

4. **Integration with Vue Ecosystem**: The package uses core Vue language tools including `@vue/language-core` and `@vue/language-service` to provide accurate language support.

## Usage Notes

When working with this project, it's important to understand:

- The web worker architecture is crucial for performance and proper Monaco integration
- The Vue language services are built on top of the TypeScript language service
- The project handles the complexity of Vue SFC parsing and analysis transparently
- Error handling and fallback mechanisms are implemented for robust operation

## Dependencies

Key runtime dependencies include:
- `@volar/monaco`, `@vue/language-core`, `@vue/language-service` - Vue language tools
- `monaco-editor-core` - The Monaco Editor itself
- `typescript` - For language service integration
- `vscode-uri` - For URI handling compatibility

Dev dependencies include:
- `vite` - for building and bundling
- `eslint` - for code linting
- `@vuebro/configs` - shared configuration files