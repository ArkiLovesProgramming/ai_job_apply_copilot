# AI Apply Copilot

Chrome extension that auto-fills open-ended questions on job applications using AI.

## Quick Start <!-- VIDEO -->

1. Install: Load `ai_apply_copilot` folder in Chrome (`chrome://extensions/`)
2. Configure API in extension popup (MiniMax M2.5 recommended)
3. Visit any job application page - questions auto-detected
4. Click ⚡ to generate AI responses

## Features

- Auto-detects open-ended questions on job forms
- Works with Simplify extension
- Supports MiniMax, OpenAI, Ollama, and any OpenAI-compatible API
- Context-aware: reads job descriptions for relevant answers

## Setup

1. Click extension icon → API tab
2. Enter API settings (MiniMax recommended):
   - Base URL: `https://api.minimax.chat/v1`
   - Model: `MiniMax-M2.5`
   - API Key: Get from [platform.minimax.io](https://platform.minimax.io/)
3. Test Connection

### Other Providers

| Provider | Base URL | Model |
|----------|----------|-------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama | `http://localhost:11434/v1` | `llama3` |

## Privacy

All data stays local. API keys stored in Chrome. Only your configured AI API receives data.

## License

MIT
