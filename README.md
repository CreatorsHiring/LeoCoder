# LeoCoder

**Smart LLM router for vibe coding - local first, cloud fallback**

Save cloud tokens by intelligently routing simple tasks to local models and complex tasks to cloud APIs. Build features faster by letting AI handle the coding while you focus on the vision.

> 💡 **Perfect for low-end PCs** - Uses local AI models (free, no API keys) with optional cloud fallback

[![npm version](https://badge.fury.io/js/leocoder.svg)](https://badge.fury.io/js/leocoder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/leocoder)](https://www.npmjs.com/package/leocoder)

## Install

```bash
npm install -g leocoder
```

Then just type `leocoder` in any project!

## Features

-  **Local-First**: Automatically uses local models (Ollama, LM Studio) for simple tasks
-  **Cloud Fallback**: Routes complex tasks to cloud providers (Groq, Gemini)
-  **Smart Routing**: AI-powered task classification based on complexity
-  **Token Savings**: Track tokens saved by using local models
-  **Auto File Writing**: LLM responses with filenames automatically write to disk
-  **File Operations**: Read, write, edit files directly from chat
-  **Shell Commands**: Run terminal commands safely
-  **Code Search**: Grep-like search across your codebase
-  **Project Context**: Automatic project structure analysis and context injection

## Quick Start

### 1. Install LeoCoder

```bash
npm install -g leocoder
```

### 2. Install Ollama (FREE Local AI)

Download from https://ollama.ai

Then pull a lightweight model:

```bash
# For low-end PCs (1-2GB RAM)
ollama pull qwen2.5-coder:1.5b

# Or even smaller
ollama pull tinyllama
```

### 3. Start Vibecoding

```bash
# Navigate to any project
cd my-project

# Just type:
leocoder
```

## Vibecoding Workflow

LeoCoder is designed for **flow state coding**. Here's how to use it effectively:

### Mode 1: Interactive Chat (Recommended)

Start a session and build features conversationally:

```bash
leocoder
```

**Example Session:**

```
> create a express server with a /api/users endpoint

┌─ LEOCODER [LOCAL]
│ ✓ Created server.ts with Express setup
│ ✓ Created routes/users.ts with GET /api/users
│ ✓ Added package.json with dependencies
└────────────────────────────────────────────

> add TypeScript types for User

┌─ LEOCODER [LOCAL]
│ ✓ Created types/user.ts
│ ✓ Updated routes/users.ts with types
└────────────────────────────────────────────

> run npm install

$ npm install
[installs dependencies]

> now add a POST endpoint to create users

┌─ LEOCODER [CLOUD]
│ ✓ Updated routes/users.ts with POST endpoint
│ ✓ Added validation logic
└────────────────────────────────────────────
```

### Mode 2: Single Question

Quick answers without starting a session:

```bash
leocoder ask "How do I implement debounce in JavaScript?"
```

### Mode 3: Project-Aware Coding

LeoCoder automatically analyzes your project structure on first run. Just start coding:

```bash
cd my-project
leocoder
```

The AI will understand your:
- Tech stack (React, Express, etc.)
- Project structure
- Important files
- Coding patterns

## Chat Commands

| Command | Description |
|---------|-------------|
| `/file <path>` | Open a file as persistent context |
| `/close` | Close the currently open file |
| `/cd <dir>` | Change working directory for file writes |
| `/write <path> [content]` | Manually write content to a file |
| `/read <path>` | Read and display a file |
| `/search <pattern>` | Search for pattern in files |
| `/run <command>` | Run a shell command |
| `/models` | Show active models |
| `/stats` | Show token usage stats |
| `/bug` | Report an issue |
| `/help` | Show help |
| `exit`, `quit` | End session |

## Auto File Writing

When the LLM generates code with a filename in the code fence, it **automatically writes to disk**:

**You say:**
```
create a utils/math.ts with add, subtract, multiply functions
```

**LeoCoder writes:**
```
✓ wrote  utils/math.ts
```

**No copy-pasting needed!** Just describe what you want to build.

## Smart Routing Explained

LeoCoder analyzes each request and routes intelligently:

| Complexity | Route | Example | Speed | Cost |
|------------|-------|---------|-------|------|
| 1-3 |  Local | "add a function", "explain this" | Fast | Free |
| 4-6 |  Local | "debug this error", "add tests" | Medium | Free |
| 7-10 |  Cloud | "design auth system", "security audit" | Fast | API credits |

### Routing Examples

```
You: "complete this function"
📍 Routing: LOCAL (Complexity: 2/10, Task: code_completion)

You: "why is this async function returning undefined?"
📍 Routing: LOCAL (Complexity: 4/10, Task: debug)

You: "design a microservice architecture for real-time chat"
📍 Routing: CLOUD (Complexity: 8/10, Task: architecture_design)
```

## Vibecoding Patterns

### Pattern 1: Build by Description

Describe the feature, let AI code it:

```
> create a React component for a todo list with add, delete, and mark complete

> add localstorage persistence to the todo list

> style it with Tailwind CSS
```

### Pattern 2: Debugging Flow

```
> [paste error message]

> fix the issue

> add error handling to prevent this in the future
```

### Pattern 3: Refactoring

```
> read src/app.ts

> refactor this into smaller functions

> add TypeScript types
```

### Pattern 4: Learning While Building

```
> explain how middleware works in Express

> show me an example in my current project

> now add logging middleware
```

### Pattern 5: Test-Driven Vibecoding

```
> create tests for utils/math.ts using Jest

> make the tests pass

> add more edge case tests
```

## Configuration

Edit `config.yaml` to customize behavior:

```yaml
local:
  providers:
    - name: ollama
      enabled: true
      base_url: "http://localhost:11434"
    - name: lmstudio
      enabled: true
      base_url: "http://localhost:1234"

  # Models for your hardware
  preferred_models:
    - phi-3-mini
    - qwen2.5-coder:1.5b
    - deepseek-coder:1.3b

routing:
  complexity:
    local_threshold: 3   # Below = local
    cloud_threshold: 7   # Above = cloud
```

## Recommended Models for Low-End Hardware

For **i5-8th Gen with limited RAM**:

| Model | Size | Quality | Speed |
|-------|------|---------|-------|
| `phi-3-mini` | 3.8B | ⭐⭐⭐⭐ | Fast |
| `qwen2.5-coder:1.5b` | 1.5B | ⭐⭐⭐ | Very Fast |
| `deepseek-coder:1.3b` | 1.3B | ⭐⭐⭐ | Very Fast |
| `tinyllama` | 1.1B | ⭐⭐ | Fastest |

### Pull Models

```bash
ollama pull phi-3-mini
ollama pull qwen2.5-coder:1.5b
ollama pull deepseek-coder:1.3b
```

## Token Savings

Based on typical vibecoding sessions:

| Task Type | Local % | Cloud % | Est. Savings |
|-----------|---------|---------|--------------|
| Autocomplete | 100% | 0% | ~50k tokens/day |
| Code Explanation | 90% | 10% | ~30k tokens/day |
| Debugging | 60% | 40% | ~15k tokens/day |
| Complex Tasks | 0% | 100% | - |

**Total estimated savings: 70-80% of cloud tokens**

## Project Context System

On first run in a new project, LeoCoder creates a `.leocoder/` folder with:

- `repomap.json` - Project structure analysis
- `leocodercontext.md` - Tech stack and architecture overview
- `session.json` - Current task tracking
- `rules.md` - Coding preferences
- `tasks.json` - Active task list

This context is automatically injected into every prompt, making the AI aware of your project.

## Troubleshooting

### "No local provider available"

- Make sure Ollama is running: `ollama serve`
- Check LM Studio server is started
- Verify base URLs in config

### "Cloud provider unavailable"

- Check API keys in `.env`
- Verify internet connection
- Check API quota limits

### Model too slow

- Use smaller models (1-3B)
- Enable CPU inference
- Close other applications

### Files not writing automatically

- Ensure the LLM output includes the filename in the code fence:
  ```
  ```typescript src/utils/helper.ts
  // code here
  ```
  ```

## API Keys (Free Tiers)

| Provider | Free Tier | Get Key |
|----------|-----------|---------|
| Groq | ✅ Yes | https://console.groq.com/keys |
| Gemini | ✅ Yes | https://makersuite.google.com/app/apikey |
| Anthropic | ❌ Paid | https://console.anthropic.com/ |

## Contributing

Want to improve LeoCoder? See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT

---

**Happy Vibecoding! 🚀**

Just describe what you want to build, and let LeoCoder handle the coding.
