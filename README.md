# OpenGravity

OpenGravity is a powerful, locally-hosted AI coding assistant tightly integrated directly into Visual Studio Code. Powered by Ollama, OpenGravity acts as an intelligent agent capable of deep codebase analysis, autonomous file reading, code generation, and inline autocompletions—all while keeping your data 100% private and local.

## Features

- **Native Sidebar Integration:** Docks seamlessly into your VS Code Activity Bar (Secondary Side Bar recommended) so it's always available without taking up valuable editor space.
- **Deep Codebase Context:** OpenGravity automatically reads the contents of your currently active file and all other open files. It also reads your workspace folder structure to understand the layout of your project.
- **Autonomous File Reading:** If the agent needs more context to answer your question, it can independently request and read any unopen file in your workspace, ensuring it always has the full picture.
- **Implementation Planning:** For complex tasks, OpenGravity is constrained to generate an Implementation Plan first. This prevents the agent from making eager, unchecked code changes and gives you full control over the architecture.
- **Apply All Code Changes:** Once a plan is approved, the agent generates the necessary code blocks. A single click of the "Apply All Code Changes" button sequentially injects the new code directly into your active editor.
- **Inline Ghost Text Autocomplete:** Provides real-time, as-you-type code suggestions using your local LLM, similar to GitHub Copilot.
- **Image/Vision Support:** Paste images directly into the chat if you are using a vision-capable model (like `llava`).

## Requirements

OpenGravity requires [Ollama](https://ollama.com/) to be installed and running on your machine (or accessible via your network).

You will also need to pull at least one model before using the extension. For coding, models like `llama3`, `deepseek-coder-v2`, or `qwen2.5-coder` are recommended.

```bash
ollama run llama3
```

## Extension Settings

You can customize OpenGravity's behavior in the VS Code Settings (`Ctrl+,` or `Cmd+,`) under **Extensions > OpenGravity**:

*   `opengravity.url`: The URL of your Ollama server (default: `http://localhost:11434`).
*   `opengravity.model`: The default model to use for chat and generation (default: `llama3`).
*   `opengravity.temperature`: The temperature for generation, controlling creativity. Lower is better for code (default: `0.2`).
*   `opengravity.maxTokens`: The maximum number of tokens to generate per response. Set to `-1` for unlimited (default: `-1`).
*   `opengravity.enableAutocomplete`: Enable or disable the inline ghost text completion provider (default: `true`).

## Usage

1. Open the OpenGravity sidebar from the Activity Bar (the OpenGravity logo).
2. Ensure Ollama is running.
3. Select your desired model from the dropdown at the top.
4. Start chatting! Ask questions about your code, request refactors, or ask the agent to plan out new features.

### The "Plan First" Workflow
If you ask OpenGravity to write a new feature, it will first output an **Implementation Plan**.
1. Review the proposed plan.
2. Click **Approve Plan** in the UI.
3. The agent will then generate the corresponding code blocks.
4. Click **Apply All Code Changes** to inject the code into your active text editor.

## Development

To build and run the extension locally:

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run compile` to build the TypeScript code.
4. Press `F5` in VS Code to open a new window with the extension loaded (Extension Development Host).

Or package it yourself:
```bash
npx vsce package
```
