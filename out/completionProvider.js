"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaCompletionProvider = void 0;
const vscode = require("vscode");
const ollamaService_1 = require("./ollamaService");
class OllamaCompletionProvider {
    constructor() {
        this._ollamaService = new ollamaService_1.OllamaService();
    }
    async provideInlineCompletionItems(document, position, context, token) {
        const config = vscode.workspace.getConfiguration('opengravity');
        if (!config.get('enableAutocomplete', true)) {
            return [];
        }
        // Debounce
        return new Promise((resolve) => {
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = setTimeout(async () => {
                if (token.isCancellationRequested) {
                    resolve([]);
                    return;
                }
                // Simple prompt: context before cursor
                // Ideally we would use FIM (Fill-In-The-Middle) here
                const textBefore = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
                // Limit context size to avoid huge prompts
                const contextSize = 1000;
                const prompt = textBefore.slice(-contextSize);
                const completion = await this._ollamaService.generate(prompt);
                if (completion && !token.isCancellationRequested) {
                    // Start range at position
                    resolve([new vscode.InlineCompletionItem(completion, new vscode.Range(position, position))]);
                }
                else {
                    resolve([]);
                }
            }, 500); // 500ms debounce
        });
    }
}
exports.OllamaCompletionProvider = OllamaCompletionProvider;
//# sourceMappingURL=completionProvider.js.map