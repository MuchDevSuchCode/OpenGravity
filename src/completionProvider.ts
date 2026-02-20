import * as vscode from 'vscode';
import { OllamaService } from './ollamaService';

export class OllamaCompletionProvider implements vscode.InlineCompletionItemProvider {
    private _ollamaService: OllamaService;
    private _timer: NodeJS.Timeout | undefined;

    constructor() {
        this._ollamaService = new OllamaService();
    }

    public async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[]> {

        const config = vscode.workspace.getConfiguration('opengravity');
        if (!config.get<boolean>('enableAutocomplete', true)) {
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
                } else {
                    resolve([]);
                }
            }, 500); // 500ms debounce
        });
    }
}
