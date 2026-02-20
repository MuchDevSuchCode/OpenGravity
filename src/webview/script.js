const vscode = acquireVsCodeApi();

const messagesContainer = document.getElementById('messages');
const input = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const imagePreview = document.getElementById('image-preview');
const modelSelect = document.getElementById('model-select');

let images = [];
let currentAssistantMessageDiv = null;
let currentAssistantMessageContent = '';
let currentModel = '';
let currentActiveModels = [];

// Initialize
window.addEventListener('load', () => {
    vscode.postMessage({ command: 'getSettings' });
    vscode.postMessage({ command: 'getModels' });
    input.focus();
});

// Handle Messages from Extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'chatResponse':
            removeLoadingIndicator();
            updateAssistantMessage(message.text);
            break;
        case 'chatDone':
            removeLoadingIndicator();
            if (currentAssistantMessageDiv) {
                const summaryDiv = document.createElement('div');
                summaryDiv.style.fontSize = '0.8em';
                summaryDiv.style.color = '#a0a0a0';
                summaryDiv.style.marginTop = '10px';

                if (message.metrics && message.metrics.eval_count) {
                    const tokens = message.metrics.eval_count;
                    const seconds = (message.metrics.eval_duration || 0) / 1e9;
                    const tps = seconds > 0 ? (tokens / seconds).toFixed(1) : 0;
                    const time = new Date().toLocaleTimeString();
                    summaryDiv.innerText = `Generated at ${time} | Tokens: ${tokens} | Speed: ${tps} t/s`;
                } else {
                    summaryDiv.innerText = `Generated at ${new Date().toLocaleTimeString()} (Metrics unavailable)`;
                }
                currentAssistantMessageDiv.querySelector('.message-content').appendChild(summaryDiv);
                scrollToBottom();
            }
            currentAssistantMessageDiv = null;
            currentAssistantMessageContent = '';
            break;
        case 'modelsList':
            populateModels(message.models);
            break;
        case 'settings':
            if (message.model) {
                currentModel = message.model;
                // Set dropdown if populated, else it will be set in populateModels
                if (modelSelect.options.length > 1) {
                    modelSelect.value = currentModel;
                }
            }
            break;
        case 'updateActiveModels':
            currentActiveModels = message.activeModels || [];
            updateMemoryDisplay();
            break;
    }
});

function populateModels(models) {
    modelSelect.innerHTML = '';

    if (models.length === 0) {
        const option = document.createElement('option');
        option.text = "No models found";
        modelSelect.add(option);
        updateMemoryDisplay();
        return;
    }

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.text = model;
        modelSelect.add(option);
    });

    if (currentModel) {
        modelSelect.value = currentModel;
    }

    updateMemoryDisplay();
}

function updateMemoryDisplay() {
    const memorySpan = document.getElementById('model-memory');
    if (!currentModel || currentActiveModels.length === 0) {
        memorySpan.style.display = 'none';
        return;
    }

    const activeModel = currentActiveModels.find(m => m.name === currentModel || m.model === currentModel);
    if (activeModel && activeModel.size) {
        const sizeGB = (activeModel.size / (1024 * 1024 * 1024)).toFixed(2);
        memorySpan.innerText = `${sizeGB} GB`;
        memorySpan.style.display = 'inline';
    } else {
        memorySpan.style.display = 'none';
    }
}

// Model Selection
modelSelect.addEventListener('change', () => {
    currentModel = modelSelect.value;
    vscode.postMessage({ command: 'setModel', model: currentModel });
});

// Send Message
function sendMessage() {
    const text = input.value.trim();
    if (!text && images.length === 0) return;

    addMessage(text, 'user', images);
    addLoadingIndicator();
    vscode.postMessage({ command: 'chat', text: text, images: images, model: currentModel });

    input.value = '';
    input.style.height = 'auto'; // Reset height
    images = [];
    imagePreview.innerHTML = '';
}

sendBtn.addEventListener('click', sendMessage);

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});


// Paste Image Handling
window.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const b64 = event.target.result.split(',')[1];
                images.push(b64);

                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'preview-thumb';
                imagePreview.appendChild(img);
            };
            reader.readAsDataURL(blob);
        }
    }
});


// Auto-resize textarea
input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

function addMessage(text, sender, images = []) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;

    // Header
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerText = sender === 'user' ? 'You' : 'OpenGravity';
    div.appendChild(header);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (images && images.length > 0) {
        images.forEach(b64 => {
            const img = document.createElement('img');
            img.src = 'data:image/jpeg;base64,' + b64;
            img.className = 'preview-thumb';
            contentDiv.appendChild(img);
            contentDiv.appendChild(document.createElement('br'));
        });
    }

    contentDiv.innerHTML = formatMessage(text);
    div.appendChild(contentDiv);

    messagesContainer.appendChild(div);
    scrollToBottom();

    return div;
}

function updateAssistantMessage(textChunk) {
    if (!currentAssistantMessageDiv) {
        currentAssistantMessageDiv = addMessage('', 'assistant');
    }

    currentAssistantMessageContent += textChunk;

    const contentDiv = currentAssistantMessageDiv.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.innerHTML = formatMessage(currentAssistantMessageContent);
    }
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessage(text) {
    // Hide READ_FILE requests completely from UI
    let cleanedText = text.replace(/\[READ_FILE:.*?\]/g, '');

    // Also hide incomplete [READ_FILE...] while streaming
    const partialMatch = cleanedText.match(/\[[^\]]*$/);
    if (partialMatch) {
        const p = partialMatch[0];
        if ('[READ_FILE:'.startsWith(p) || p.startsWith('[READ_FILE:')) {
            cleanedText = cleanedText.substring(0, partialMatch.index);
        }
    }

    // Simple formatting
    let content = escapeHtml(cleanedText).replace(/\n/g, '<br>');

    // Basic code block detection (very simple)
    content = content.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre><code>${code}</code><button class="insert-btn" onclick="applyCode(this)">Approve</button></pre>`;
    });

    // Plan block detection
    content = content.replace(/&lt;plan&gt;([\s\S]*?)&lt;\/plan&gt;/gi, (match, planContent) => {
        return `<div class="plan-block">
            <div class="plan-header">Implementation Plan</div>
            <div class="plan-content">${planContent}</div>
            <button class="approve-plan-btn" onclick="approvePlan(this)">Approve Plan</button>
        </div>`;
    });

    // File Read Chips
    content = content.replace(/\[\[FILE_READ_CHIP:\s*(.+?)\]\]/g, '<div style="font-size: 0.85em; color: #88c0d0; margin-bottom: 8px;"><span style="opacity: 0.8">Read file: </span><code style="background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 3px;">$1</code></div>');

    return content;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addLoadingIndicator() {
    const div = document.createElement('div');
    div.id = 'loading-indicator';
    div.className = 'message assistant';

    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerText = 'OpenGravity';
    div.appendChild(header);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-dots';
    contentDiv.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    div.appendChild(contentDiv);

    messagesContainer.appendChild(div);
    scrollToBottom();
}

function removeLoadingIndicator() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.remove();
    }
}

// Global function for insert button
window.applyCode = function (btn) {
    const pre = btn.parentElement;
    const code = pre.querySelector('code').innerText;
    vscode.postMessage({
        command: 'applyCode',
        text: code
    });

    btn.innerText = "Approved!";
    btn.style.backgroundColor = "#1e792e";
    btn.disabled = true;
};

window.approvePlan = function (btn) {
    const text = "I approve the exact plan proposed above. Please execute this plan now and write the actual code changes.";
    addMessage(text, 'user', []);
    addLoadingIndicator();

    vscode.postMessage({
        command: 'chat',
        text: text,
        images: [],
        model: currentModel
    });

    // Visual feedback
    btn.innerText = "Plan Approved!";
    btn.style.backgroundColor = "#2ea043"; // Success green
    btn.disabled = true;
};
