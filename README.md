<div align="center">
  <img src="opengravitylogo.png" alt="OpenGravity Logo" width="128" height="128">
  <h1>OpenGravity</h1>
  <p><strong>A powerful, 100% private AI coding assistant deeply integrated into VS Code.</strong></p>
  <p>Experience the cutting-edge intelligence of Google Cloud Code, GitHub Copilot, and Cursor—running entirely on your own hardware.</p>
</div>

---

OpenGravity is a premium, locally-hosted AI coding assistant tightly integrated into Visual Studio Code. Powered natively by [Ollama](https://ollama.com/) or [LM Studio](https://lmstudio.ai/), OpenGravity acts as an intelligent agent capable of deep codebase analysis, autonomous file discovery, structured implementation planning, and inline autocompletions.

## 🌟 Why OpenGravity?
1. **No usage limits:** Generate as much code as you want.
2. **No outages:** Your AI works 100% offline.
3. **Total Privacy:** Zero data ever leaves your machine or goes to the cloud.
4. **No monthly costs:** Cancel your $20/mo subscriptions.
5. **Open Source:** Fully transparent and hackable to fit your workflow.

## 🚀 Key Features

### 1. The "Clean Box" Interface
OpenGravity features a highly polished, zero-clutter conversational interface natively docked to your Secondary Side Bar. Complex markdown, syntax-highlighted code blocks, and dynamic UI elements strictly follow the beautiful "Antigravity Aesthetic".

![Interface Overview](screenshots/screen_shot_1.png)

### 2. Autonomous Context Gathering
Never copy-paste code again. OpenGravity actively reads your currently active files, maps your entire workspace directory structure, and can autonomously fetch and read un-opened files on the fly to gain the context it needs to solve your problem.

![Context Reading](screenshots/screen_shot_2.png)

### 3. Structured Implementation Plans
For complex tasks, OpenGravity is constrained to generate an **Implementation Plan** first. This prevents the agent from making eager, unchecked code changes and gives you full control over the architecture.

![Implementation Plan](screenshots/screen_shot_3.png)

### 4. One-Click Code Application
Once you click **Approve Plan**, the agent generates strictly-formatted code blocks. With a single click of the "Apply All Code Changes" button, OpenGravity sequentially injects its patches directly into your editor's files in real-time.

![Code Application](screenshots/screen_shot_4.png)

## ⚡ Additional Capabilities

- **LM Studio & Ollama Support:** Seamleassly bridge between Ollama's native API and LM Studio's OpenAI-compatible `/v1/chat/completions` endpoints.
- **Inline Ghost Text:** Get lightning-fast, as-you-type code completion suggestions using your local models right inside the editor pane.
- **Vision Model Support:** Drag and drop images into the chat to prompt advanced visually-aware models like `llava`.

---

## ⚙️ Configuration

OpenGravity exposes advanced determinism properties natively inside VS Code settings, allowing you to maximize the coding proficiency of local models. Access via **Settings > Extensions > OpenGravity**:

| Setting | Description | Default |
| --- | --- | --- |
| `opengravity.provider` | AI API Provider (`ollama` or `lmstudio`). | `ollama` |
| `opengravity.url` | URL of the local server. *(Ollama: `11434`, LM Studio: `1234`)* | `http://localhost:11434` |
| `opengravity.model` | The ID of the model to use for chat and generation. | `llama3` |
| `opengravity.contextLength` | Max Context Length (`num_ctx`). Increase heavily for deep codebase context! | `8192` |
| `opengravity.topP` | Nucleus Sampling (`top_p`). Low values enforce highly deterministic coding logic. | `0.5` |
| `opengravity.temperature` | Controls structural creativity. Lower is better for strict code. | `0.2` |
| `opengravity.systemPrompt` | Inject custom absolute rules (e.g. *"Always use tabs, never spaces"*). | `""` |

## 🛠️ Installation & Setup

1. Install [Ollama](https://ollama.com/) or [LM Studio](https://lmstudio.ai/).
2. Pull a coding-optimized model (e.g., `llama3`, `deepseek-coder-v2`, `qwen2.5-coder`):
   ```bash
   ollama run llama3
   ```
3. Download the precompiled **OpenGravity** `.vsix` extension file.
4. Open VS Code, navigate to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
5. Click the **Views and More Actions** (`...`) menu in the top right of the Extensions view and select **Install from VSIX...**.
6. Select the downloaded `.vsix` file to install it.
7. If the OpenGravity sidebar does not automatically appear on the right, press `Ctrl+Alt+B` (or `Cmd+Option+B` on Mac) to toggle the **Secondary Side Bar**, then explicitly drag the OpenGravity logo from the left Activity bar into it to dock it securely!

*Note: For maximum performance and context retention, a GPU with at least 8GB of VRAM is recommended.*
