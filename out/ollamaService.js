"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaService = void 0;
const path = require("path");
const vscode = require("vscode");
class OllamaService {
    constructor() {
        this._abortController = new AbortController();
    }
    _getProviderConfig(modelOverride) {
        const config = vscode.workspace.getConfiguration('opengravity');
        const provider = config.get('provider', 'ollama');
        const legacyUrl = config.get('url', provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434');
        const legacyUrlInspect = config.inspect('url');
        const legacyUrlSet = Boolean(legacyUrlInspect?.globalValue !== undefined
            || legacyUrlInspect?.workspaceValue !== undefined
            || legacyUrlInspect?.workspaceFolderValue !== undefined);
        const providerUrls = {
            ollama: config.get('ollamaUrl', 'http://localhost:11434'),
            lmstudio: config.get('lmstudioUrl', 'http://localhost:1234'),
            llamacpp: config.get('llamacppUrl', 'http://localhost:8080'),
            openaiCompatible: config.get('openaiCompatibleUrl', 'http://localhost:8000')
        };
        let baseUrl = providerUrls[provider] || providerUrls.ollama;
        if (legacyUrlSet && legacyUrl) {
            baseUrl = legacyUrl;
        }
        const model = modelOverride || config.get('model', 'qwen2.5-coder:7b');
        const temp = config.get('temperature', 0.15);
        const maxTokens = config.get('maxTokens', 4096);
        const numCtx = config.get('contextLength', 16384);
        const topP = config.get('topP', 0.9);
        const topK = config.get('topK', 40);
        const repeatPenalty = config.get('repeatPenalty', 1.1);
        const presencePenalty = config.get('presencePenalty', 0);
        const frequencyPenalty = config.get('frequencyPenalty', 0);
        const seed = config.get('seed', 42);
        const llamaCppApiMode = config.get('llamacppApiMode', 'openaiCompat');
        const llamaCppChatEndpoint = config.get('llamacppChatEndpoint', '/v1/chat/completions');
        const llamaCppCompletionEndpoint = config.get('llamacppCompletionEndpoint', '/completion');
        let kind = 'ollama';
        if (provider === 'lmstudio' || provider === 'openaiCompatible') {
            kind = 'openaiCompat';
        }
        else if (provider === 'llamacpp') {
            kind = llamaCppApiMode === 'native' ? 'llamacppNative' : 'openaiCompat';
        }
        return {
            provider,
            kind,
            baseUrl,
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
            llamaCppChatEndpoint,
            llamaCppCompletionEndpoint
        };
    }
    _normalizeEndpoint(baseUrl, endpoint) {
        const cleanBase = baseUrl.replace(/\/$/, '');
        if (!endpoint) {
            return cleanBase;
        }
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            return endpoint;
        }
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${cleanBase}${cleanEndpoint}`;
    }
    _messagesToPrompt(messages) {
        const lines = [];
        for (const message of messages) {
            if (message.role === 'system') {
                lines.push(`System: ${message.content}`);
            }
            else if (message.role === 'user') {
                lines.push(`User: ${message.content}`);
            }
            else if (message.role === 'assistant') {
                lines.push(`Assistant: ${message.content}`);
            }
            else if (message.role === 'tool') {
                lines.push(`Tool: ${message.content}`);
            }
        }
        lines.push('Assistant:');
        return lines.join('\n\n');
    }
    _buildRequest(messages, modelOverride, stream, tools) {
        const cfg = this._getProviderConfig(modelOverride);
        if (cfg.kind === 'openaiCompat') {
            const endpoint = cfg.provider === 'llamacpp'
                ? this._normalizeEndpoint(cfg.baseUrl, cfg.llamaCppChatEndpoint)
                : this._normalizeEndpoint(cfg.baseUrl, '/v1/chat/completions');
            const body = {
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
                cfg,
                endpoint,
                body
            };
        }
        if (cfg.kind === 'llamacppNative') {
            const endpoint = this._normalizeEndpoint(cfg.baseUrl, cfg.llamaCppCompletionEndpoint);
            const body = {
                prompt: this._messagesToPrompt(messages),
                stream,
                temperature: cfg.temp,
                top_p: cfg.topP,
                top_k: cfg.topK,
                repeat_penalty: cfg.repeatPenalty
            };
            if (cfg.maxTokens > 0) {
                body.n_predict = cfg.maxTokens;
            }
            if (cfg.seed >= 0) {
                body.seed = cfg.seed;
            }
            return {
                cfg,
                endpoint,
                body
            };
        }
        const endpoint = this._normalizeEndpoint(cfg.baseUrl, '/api/chat');
        const body = {
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
            cfg,
            endpoint,
            body
        };
    }
    async chat(messages, onChunk, modelOverride) {
        const request = this._buildRequest(messages, modelOverride, true);
        try {
            const response = await fetch(request.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    const raw = line.startsWith('data: ') ? line.slice(6) : line;
                    if (raw === '[DONE]') {
                        return { done: true };
                    }
                    try {
                        const json = JSON.parse(raw);
                        const openAiDelta = json.choices?.[0]?.delta?.content;
                        const llamaNativeDelta = json.content;
                        const ollamaDelta = json.message?.content;
                        const text = openAiDelta || llamaNativeDelta || ollamaDelta;
                        if (text) {
                            onChunk(text);
                        }
                        if (json.done === true || json.stop === true) {
                            return json;
                        }
                    }
                    catch {
                        // Ignore malformed chunks while streaming.
                    }
                }
            }
            return { done: true };
        }
        catch (error) {
            if (error.name === 'AbortError') {
                return { aborted: true };
            }
            console.error('Ollama Service Error:', error);
            onChunk(`\n\n**Error:** ${error.message}`);
            return null;
        }
    }
    async complete(messages, modelOverride, tools) {
        const request = this._buildRequest(messages, modelOverride, false, tools);
        try {
            const response = await fetch(request.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request.body),
                signal: this._abortController.signal
            });
            if (!response.ok) {
                throw new Error(`Local API Error: ${response.status} ${response.statusText}`);
            }
            const json = await response.json();
            if (request.cfg.kind === 'openaiCompat') {
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
            if (request.cfg.kind === 'llamacppNative') {
                const text = json.content || json.response || '';
                return {
                    text,
                    assistantMessage: {
                        role: 'assistant',
                        content: text
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
        }
        catch (error) {
            if (error.name === 'AbortError') {
                return { text: '', aborted: true };
            }
            throw error;
        }
    }
    _extractToolCalls(rawCalls) {
        if (!Array.isArray(rawCalls)) {
            return [];
        }
        const calls = [];
        for (const call of rawCalls) {
            const fn = call?.function;
            if (!fn?.name) {
                continue;
            }
            let parsedArgs = {};
            if (typeof fn.arguments === 'string') {
                try {
                    parsedArgs = JSON.parse(fn.arguments);
                }
                catch {
                    parsedArgs = {};
                }
            }
            else if (typeof fn.arguments === 'object' && fn.arguments) {
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
    async generate(prompt, options) {
        const cfg = this._getProviderConfig();
        const maxTokens = options?.maxTokens ?? 128;
        if (cfg.kind === 'openaiCompat') {
            const endpoint = cfg.provider === 'llamacpp'
                ? this._normalizeEndpoint(cfg.baseUrl, cfg.llamaCppChatEndpoint)
                : this._normalizeEndpoint(cfg.baseUrl, '/v1/chat/completions');
            const body = {
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
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok)
                    return '';
                const json = await response.json();
                return json.choices?.[0]?.message?.content || '';
            }
            catch {
                return '';
            }
        }
        if (cfg.kind === 'llamacppNative') {
            const endpoint = this._normalizeEndpoint(cfg.baseUrl, cfg.llamaCppCompletionEndpoint);
            const body = {
                prompt,
                stream: false,
                temperature: cfg.temp,
                top_p: cfg.topP,
                top_k: cfg.topK,
                repeat_penalty: cfg.repeatPenalty,
                n_predict: maxTokens
            };
            if (cfg.seed >= 0) {
                body.seed = cfg.seed;
            }
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok)
                    return '';
                const json = await response.json();
                return json.content || json.response || '';
            }
            catch {
                return '';
            }
        }
        const endpoint = this._normalizeEndpoint(cfg.baseUrl, '/api/generate');
        const body = {
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
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                return '';
            }
            const json = await response.json();
            return json.response || '';
        }
        catch (e) {
            console.error('Ollama Generate Error:', e);
            return '';
        }
    }
    async getModels() {
        const cfg = this._getProviderConfig();
        try {
            if (cfg.kind === 'openaiCompat') {
                const endpoint = this._normalizeEndpoint(cfg.baseUrl, '/v1/models');
                const response = await fetch(endpoint);
                if (!response.ok) {
                    return [];
                }
                const json = await response.json();
                return (json.data || []).map((m) => m.id).filter(Boolean);
            }
            if (cfg.kind === 'llamacppNative') {
                const tryEndpoints = ['/models', '/props'];
                for (const ep of tryEndpoints) {
                    try {
                        const response = await fetch(this._normalizeEndpoint(cfg.baseUrl, ep));
                        if (!response.ok) {
                            continue;
                        }
                        const json = await response.json();
                        if (Array.isArray(json.models)) {
                            const models = json.models.map((m) => m.id || m.name).filter(Boolean);
                            if (models.length > 0)
                                return models;
                        }
                        if (Array.isArray(json.data)) {
                            const models = json.data.map((m) => m.id || m.name).filter(Boolean);
                            if (models.length > 0)
                                return models;
                        }
                        if (typeof json.model_path === 'string' && json.model_path) {
                            return [path.basename(json.model_path)];
                        }
                    }
                    catch {
                        // Try next endpoint.
                    }
                }
                return [];
            }
            const response = await fetch(this._normalizeEndpoint(cfg.baseUrl, '/api/tags'));
            if (!response.ok) {
                return [];
            }
            const json = await response.json();
            return (json.models || []).map((m) => m.name).filter(Boolean);
        }
        catch (e) {
            console.error('GetModels Error:', e);
            return [];
        }
    }
    async getActiveModels() {
        const cfg = this._getProviderConfig();
        if (cfg.provider !== 'ollama') {
            return [];
        }
        const endpoint = this._normalizeEndpoint(cfg.baseUrl, '/api/ps');
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                return [];
            }
            const json = await response.json();
            return json.models || [];
        }
        catch (e) {
            console.error('Ollama GetActiveModels Error:', e);
            return [];
        }
    }
    cancelChat() {
        this._abortController.abort();
        this._abortController = new AbortController();
    }
}
exports.OllamaService = OllamaService;
//# sourceMappingURL=ollamaService.js.map