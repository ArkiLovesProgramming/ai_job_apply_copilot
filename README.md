# AI Apply Copilot

An AI-powered Chrome extension that automatically detects and fills open-ended questions on job application forms.

## Features

- **Auto-detection**: Automatically identifies open-ended questions on job application forms
- **AI-powered**: Uses LLM (OpenAI compatible APIs) to generate personalized responses
- **Multi-platform support**: Works with Greenhouse, Lever, Workday, SmartRecruiters, and other ATS systems
- **Context-aware**: Reads job descriptions and company info to provide relevant answers
- **Custom user context**: Save your background, skills, and experiences for personalized responses

## Installation

### From Source

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `ai_apply_copilot` folder

## Setup

1. Click the extension icon in Chrome
2. Go to the "API" tab
3. Enter your API settings:
   - **Base URL**: Your API endpoint (default: `https://api.minimax.chat/v1`)
   - **Model**: Model name (default: `MiniMax-M2.5`)
   - **API Key**: Your API key
4. Click "Test Connection" to verify

### Using MiniMax (Recommended)

- Base URL: `https://api.minimax.chat/v1`
- Model: `MiniMax-M2.5` (recommended for best speed and quality)
- API Key: Get from [MiniMax Platform](https://platform.minimax.io/)

### Using OpenAI

- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4o-mini`, `gpt-4o` or `gpt-4o-2025-01-27`

### Using Other Providers

Compatible with any OpenAI-compatible API:
- [Ollama](https://ollama.ai/)
- [LM Studio](https://lmstudio.ai/)
- [Jan.ai](https://jan.ai/)
- [OneAPI](https://github.com/songxian/one-api)

## Usage

1. Visit a job application page
2. The extension automatically detects open-ended questions
3. Click the "⚡" button next to any question
4. AI generates a personalized response based on:
   - Job title and company
   - Job description
   - Your saved context

### User Context

Add your background info in the "User" tab:
- Work experience
- Skills
- Achievements
- Career goals

This helps AI generate more relevant responses.

## Supported Platforms

- Greenhouse
- Lever
- Workday
- SmartRecruiters
- Jobvite
- Taleo
- iCIMS
- Ashby
- Recruitee
- And more...

## Privacy

- All data is stored locally in your browser
- API keys are encrypted in Chrome storage
- No data is sent to any server except your configured AI API
- Job info is extracted only from pages you visit

## Tech Stack

- Vanilla JavaScript (no framework)
- Chrome Extension APIs
- OpenAI Compatible APIs

## License

MIT License - see [LICENSE](LICENSE)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.
