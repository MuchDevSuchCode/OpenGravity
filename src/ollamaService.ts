import * as vscode from 'vscode';

export type ChatMessage = {
    role: string;
    content: string;
    images?: string[];
    [key: string]: any;
};

export type ToolDefinition = {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
    };
};

export type ParsedToolCall = {
    id?: string;
    name: string;
    arguments: Record<string, any>;
};

type GenerateOptions = {
    maxTokens?: number;
};

export class OllamaService {
    private _abortController: AbortController = new AbortController();

    private _getProviderConfig(modelOverride?: string) {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get<string>('provider', 'ollama');
        const url = config.get<string>('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');
        const model = modelOverride || config.get<string>('model', 'qwen2.5-coder:7b');
        const temp = config.get<number>('temperature', 0.15);
        const maxTokens = config.get<number>('maxTokens', 4096);
        const numCtx = config.get<number>('contextLength', 16384);
        const topP = config.get<number>('topP', 0.9);
        const topK = config.get<number>('topK', 40);
        const repeatPenalty = config.get<number>('repeatPenalty', 1.1);
        const presencePenalty = config.get<number>('presencePenalty', 0);
        const frequencyPenalty = config.get<number>('frequencyPenalty', 0);
        const seed = config.get<number>('seed', 42);
        const openAiCompatible = provider === 'lmstudio' || provider === 'llamacpp' || provider === 'openaiCompatible';

        return {
            provider,
            url,
            model,
            temp,
            maxTokens,
            numCtx,
            topP,
            topK,
            repeatPenalty,
            presencePenalty,
            frequencyPenalty,
            seed,
            openAiCompatible
        };
    }

    private _buildChatRequest(messages: ChatMessage[], modelOverride: string | undefined, stream: boolean, tools?: ToolDefinition[]) {
        const cfg = this._getProviderConfig(modelOverride);

        if (cfg.openAiCompatible) {
            const body: any = {
                model: cfg.model,
                messages,
                stream,
                temperature: cfg.temp,
                top_p: cfg.topP,
                frequency_penalty: cfg.frequencyPenalty,
                presence_penalty: cfg.presencePenalty
            };
            if (cfg.maxTokens > 0) {
                body.max_tokens = cfg.maxTokens;
            }
            if (cfg.seed >= 0) {
                body.seed = cfg.seed;
            }
            if (tools && tools.length > 0) {
                body.tools = tools;
                body.tool_choice = 'auto';
            }
            return {
                fullUrl: `${cfg.url.replace(/\/$/, '')}/v1/chat/completions`,
                body,
                openAiCompatible: cfg.openAiCompatible
            };
        }

        const body: any = {
            model: cfg.model,
            messages,
            stream,
            options: {
                temperature: cfg.temp,
                num_ctx: cfg.numCtx,
                top_p: cfg.topP,
                top_k: cfg.topK,
                repeat_penalty: cfg.repeatPenalty
            }
        };
        if (cfg.maxTokens > 0) {
            body.options.num_predict = cfg.maxTokens;
        }
        if (cfg.seed >= 0) {
            body.options.seed = cfg.seed;
        }
        if (tools && tools.length > 0) {
            body.tools = tools;
        }

        return {
            fullUrl: `${cfg.url.replace(/\/$/, '')}/api/chat`,
            body,
            openAiCompatible: cfg.openAiCompatible
        };
    }

    public async chat(messages: ChatMessage[], onChunk: (text: string) => void, modelOverride?: string): Promise<any> {
        const request = this._buildChatRequest(messages, modelOverride, true);

        try {
            const response = await fetch(request.fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request.body),
                signal: this._abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Local API Error: ${response.status} ${response.statusText}`);
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

                    if (request.openAiCompatible) {
                        if (line.includes('[DONE]')) {
                            return { done: true };
                        }
                        if (line.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(line.slice(6));
                                if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                                    onChunk(json.choices[0].delta.content);
                                }
                            } catch {
                                // Ignore malformed chunks while streaming.
                            }
                        }
                    } else {
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                onChunk(json.message.content);
                            }
                            if (json.done) {
                                return json;
                            }
                            if (json.error) {
                                throw new Error(json.error);
                            }
                        } catch {
                            // Ignore malformed chunks while streaming.
                        }
                    }
                }
            }
            if (request.openAiCompatible) return { done: true };
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

    public async complete(
        messages: ChatMessage[],
        modelOverride?: string,
        tools?: ToolDefinition[]
    ): Promise<{ text: string; raw?: any; aborted?: boolean; assistantMessage?: ChatMessage; toolCalls?: ParsedToolCall[] }> {
        const request = this._buildChatRequest(messages, modelOverride, false, tools);

        try {
            const response = await fetch(request.fullUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request.body),
                signal: this._abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Local API Error: ${response.status} ${response.statusText}`);
            }

            const json: any = await response.json();
            if (request.openAiCompatible) {
                const message = json.choices?.[0]?.message || {};
                return {
                    text: message.content || '',
                    toolCalls: this._extractToolCalls(message.tool_calls),
                    assistantMessage: {
                        role: message.role || 'assistant',
                        content: message.content || '',
                        tool_calls: message.tool_calls
                    },
                    raw: json
                };
            }

            const message = json.message || {};
            return {
                text: message.content || '',
                toolCalls: this._extractToolCalls(message.tool_calls),
                assistantMessage: {
                    role: message.role || 'assistant',
                    content: message.content || '',
                    tool_calls: message.tool_calls
                },
                raw: json
            };
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return { text: '', aborted: true };
            }
            throw error;
        }
    }

    private _extractToolCalls(rawCalls: any): ParsedToolCall[] {
        if (!Array.isArray(rawCalls)) {
            return [];
        }

        const calls: ParsedToolCall[] = [];
        for (const call of rawCalls) {
            const fn = call?.function;
            if (!fn?.name) {
                continue;
            }

            let parsedArgs: Record<string, any> = {};
            if (typeof fn.arguments === 'string') {
                try {
                    parsedArgs = JSON.parse(fn.arguments);
                } catch {
                    parsedArgs = {};
                }
            } else if (typeof fn.arguments === 'object' && fn.arguments) {
                parsedArgs = fn.arguments;
            }

            calls.push({
                id: typeof call.id === 'string' ? call.id : undefined,
                name: String(fn.name),
                arguments: parsedArgs
            });
        }

        return calls;
    }

    public async generate(prompt: string, options?: GenerateOptions): Promise<string> {
        const cfg = this._getProviderConfig();
        const maxTokens = options?.maxTokens ?? 128;

        if (cfg.openAiCompatible) {
            const fullUrl = `${cfg.url.replace(/\/$/, '')}/v1/chat/completions`;
            const body: any = {
                model: cfg.model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                temperature: cfg.temp,
                top_p: cfg.topP,
                frequency_penalty: cfg.frequencyPenalty,
                presence_penalty: cfg.presencePenalty,
                max_tokens: maxTokens
            };
            if (cfg.seed >= 0) {
                body.seed = cfg.seed;
            }
            try {
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok) return '';
                const json: any = await response.json();
                return json.choices?.[0]?.message?.content || '';
            } catch {
                return '';
            }
        }

        const fullUrl = `${cfg.url.replace(/\/$/, '')}/api/generate`;

        const body: any = {
            model: cfg.model,
            prompt,
            stream: false,
            options: {
                temperature: cfg.temp,
                top_p: cfg.topP,
                top_k: cfg.topK,
                repeat_penalty: cfg.repeatPenalty,
                num_ctx: cfg.numCtx,
                num_predict: maxTokens
            }
        };
        if (cfg.seed >= 0) {
            body.options.seed = cfg.seed;
        }

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
        const openAiCompatible = provider === 'lmstudio' || provider === 'llamacpp' || provider === 'openaiCompatible';

        const fullUrl = openAiCompatible
            ? `${url.replace(/\/$/, '')}/v1/models`
            : `${url.replace(/\/$/, '')}/api/tags`;

        try {
            const response = await fetch(fullUrl);
            if (!response.ok) {
                return [];
            }
            const json: any = await response.json();
            if (openAiCompatible) {
                return (json.data || []).map((m: any) => m.id);
            }
            return (json.models || []).map((m: any) => m.name);
        } catch (e) {
            console.error('GetModels Error:', e);
            return [];
        }
    }

    public async getActiveModels(): Promise<any[]> {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get<string>('provider', 'ollama');
        const url = config.get<string>('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');

        if (provider !== 'ollama') {
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
