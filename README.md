# LeoCoder 🚀

**Smart LLM router for vibe coding - local first, cloud fallback**

Save cloud tokens by intelligently routing simple tasks to local models and complex tasks to cloud APIs.

## Features

- 🏠 **Local-First**: Automatically uses local models (Ollama, LM Studio) for simple tasks
- ☁️ **Cloud Fallback**: Routes complex tasks to cloud providers (Groq, Gemini)
- 🧠 **Smart Routing**: AI-powered task classification based on complexity
- 💰 **Token Savings**: Track tokens saved by using local models
- 🛠️ **File Operations**: Read, write, edit files directly from chat
- 💻 **Shell Commands**: Run terminal commands safely
- 🔍 **Code Search**: Grep-like search across your codebase

## Installation

### 1. Clone and Install Dependencies

```bash
cd LeoCoder
npm install
npm run build
```

### 2. Setup Environment Variables

Copy the example env file and add your API keys:

```bash
copy .env.example .env
```

Edit `.env` and add your keys:

```env
# Get from https://console.groq.com/keys (Free tier)
GROQ_API_KEY=gsk_...

# Get from https://makersuite.google.com/app/apikey (Free tier)
GEMINI_API_KEY=...
```

### 3. Install Local Models (Recommended)

For **Ollama** (recommended for low-end hardware):

```bash
# Install Ollama from https://ollama.ai

# Download a lightweight coding model
ollama pull phi-3-mini
# or
ollama pull qwen2.5-coder:1.5b
# or
ollama pull deepseek-coder:1.3b
```

For **LM Studio**:

1. Download from https://lmstudio.ai
2. Download a quantized model (1-3B recommended)
3. Start the local server

## Usage

### Start Interactive Chat

```bash
npm start
# or
node dist/index.js chat
```

### Ask a Single Question

```bash
node dist/index.js ask "Explain this function..."
```

### Check Provider Status

```bash
node dist/index.js status
```

## Chat Commands

| Command | Description |
|---------|-------------|
| `/file <path>` | Open a file for context |
| `/read <path>` | Read and display a file |
| `/search <pattern>` | Search for pattern in files |
| `/run <command>` | Run a shell command |
| `/models` | Show active models |
| `/stats` | Show token usage stats |
| `/help` | Show help |
| `exit`, `quit` | End session |

## How Routing Works

The router analyzes each request and assigns a **complexity score (1-10)**:

| Complexity | Route | Example Tasks |
|------------|-------|---------------|
| 1-3 | 🏠 Local | Autocomplete, explain code, format, simple fixes |
| 4-6 | 🏠 Local (default) | Debug, optimize, small refactors |
| 7-10 | ☁️ Cloud | Architecture, complex refactors, security audits |

### Examples

```
You: "complete this function"
📍 Routing: LOCAL (Complexity: 2/10, Task: code_completion)

You: "design a microservice architecture for..."
📍 Routing: CLOUD (Complexity: 8/10, Task: architecture_design)

You: "explain what this code does"
📍 Routing: LOCAL (Complexity: 3/10, Task: explain_code)
```

## Configuration

Edit `config.yaml` to customize:

```yaml
local:
  preferred_models:
    - phi-3-mini      # Best for coding
    - qwen2.5-coder:1.5b
    - deepseek-coder:1.3b
  max_model_size_gb: 4  # Adjust for your RAM

cloud:
  token_budget:
    daily_limit: 100000  # Cloud tokens per day

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

## Token Savings Estimate

Based on typical usage:

| Task Type | Local % | Cloud % | Est. Savings |
|-----------|---------|---------|--------------|
| Autocomplete | 100% | 0% | ~50k tokens/day |
| Code Explanation | 90% | 10% | ~30k tokens/day |
| Debugging | 60% | 40% | ~15k tokens/day |
| Complex Tasks | 0% | 100% | - |

**Total estimated savings: 70-80% of cloud tokens**

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
- Enable CPU-only mode
- Close other applications

## License

MIT
