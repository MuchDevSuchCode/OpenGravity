import * as vscode from 'vscode';

export class OllamaService {
    private _abortController: AbortController = new AbortController();

    public async chat(messages: { role: string, content: string, images?: string[] }[], onChunk: (text: string) => void, modelOverride?: string): Promise<any> {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get<string>('provider', 'ollama');
        const url = config.get<string>('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');
        const model = modelOverride || config.get<string>('model', 'llama3');
        const temp = config.get<number>('temperature', 0.2);
        const maxTokens = config.get<number>('maxTokens', -1);
        const numCtx = config.get<number>('contextLength', 8192);
        const topP = config.get<number>('topP', 0.5);
        const topK = config.get<number>('topK', 40);

        let fullUrl = '';
        let body: any = {};

        if (provider === 'lmstudio') {
            fullUrl = `${url.replace(/\/$/, '')}/v1/chat/completions`;
            body = {
                model: model,
                messages: messages,
                stream: true,
                temperature: temp,
                top_p: topP
            };
            if (maxTokens !== -1) {
                body.max_tokens = maxTokens;
            }
        } else {
            fullUrl = `${url.replace(/\/$/, '')}/api/chat`;
            body = {
                model: model,
                messages: messages,
                stream: true,
                options: {
                    temperature: temp,
                    num_ctx: numCtx,
                    top_p: topP,
                    top_k: topK
                }
            };
            if (maxTokens !== -1) {
                body.options.num_predict = maxTokens;
            }
        }

        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                signal: this._abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (provider === 'lmstudio') {
                        if (line.includes('[DONE]')) {
                            return { done: true };
                        }
                        if (line.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(line.slice(6));
                                if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                                    onChunk(json.choices[0].delta.content);
                                }
                            } catch (e) { }
                        }
                    } else {
                        try {
                            const json = JSON.parse(line);
                            // Ollama 'chat' endpoint returns 'message' object
                            if (json.message && json.message.content) {
                                onChunk(json.message.content);
                            }
                            if (json.done) {
                                return json;
                            }
                            if (json.error) {
                                throw new Error(json.error);
                            }
                        } catch (e) {
                            // console.error('Error parsing JSON chunk', e);
                        }
                    }
                }
            }
            if (provider === 'lmstudio') return { done: true };
            return null;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return { aborted: true };
            }
            console.error('Ollama Service Error:', error);
            onChunk(`\n\n**Error:** ${error.message}`);
            return null;
        }
    }

    public async generate(prompt: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get<string>('provider', 'ollama');
        const url = config.get<string>('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');
        const model = config.get<string>('model', 'llama3');
        const temp = config.get<number>('temperature', 0.2);

        if (provider === 'lmstudio') {
            const fullUrl = `${url.replace(/\/$/, '')}/v1/chat/completions`;
            const body = {
                model: model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                temperature: temp,
                max_tokens: 50
            };
            try {
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok) return '';
                const json: any = await response.json();
                return json.choices?.[0]?.message?.content || '';
            } catch (e) { return ''; }
        }

        const fullUrl = `${url.replace(/\/$/, '')}/api/generate`;

        const body = {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: temp,
                num_predict: 50 // Short generation for autocomplete
            }
        };

        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                return '';
            }

            const json: any = await response.json();
            return json.response || '';
        } catch (e) {
            console.error('Ollama Generate Error:', e);
            return '';
        }
    }

    public async getModels(): Promise<string[]> {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get<string>('provider', 'ollama');
        const url = config.get<string>('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');

        const fullUrl = provider === 'lmstudio'
            ? `${url.replace(/\/$/, '')}/v1/models`
            : `${url.replace(/\/$/, '')}/api/tags`;

        try {
            const response = await fetch(fullUrl);
            if (!response.ok) {
                return [];
            }
            const json: any = await response.json();
            if (provider === 'lmstudio') {
                return json.data.map((m: any) => m.id);
            }
            return json.models.map((m: any) => m.name);
        } catch (e) {
            console.error('GetModels Error:', e);
            return [];
        }
    }

    public async getActiveModels(): Promise<any[]> {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get<string>('provider', 'ollama');
        const url = config.get<string>('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');

        if (provider === 'lmstudio') {
            return [];
        }

        const fullUrl = `${url.replace(/\/$/, '')}/api/ps`;

        try {
            const response = await fetch(fullUrl);
            if (!response.ok) {
                return [];
            }
            const json: any = await response.json();
            return json.models || [];
        } catch (e) {
            console.error('Ollama GetActiveModels Error:', e);
            return [];
        }
    }

    public cancelChat() {
        this._abortController.abort();
        this._abortController = new AbortController();
    }
}
