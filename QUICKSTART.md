# LeoCoder - Quick Start Guide 🚀

## Setup Complete! ✓

Your **LeoCoder** smart LLM router is built and ready to use.

## Current Status

- **Local Provider**: Ollama detected with model `qwen2.5:1.5b`
- **Cloud Providers**: Need API keys (optional - get free keys)

## Quick Commands

### 1. Start Interactive Chat (Recommended!)
```bash
npm start
```
or
```bash
node dist/index.js chat
```

### 2. Ask a Quick Question
```bash
node dist/index.js ask "What is a closure in JavaScript?"
```

### 3. Check Provider Status
```bash
node dist/index.js status
```

## Chat Interface

When you start chat, you'll see:

```
╔══════════════════════════════════════════════════════════╗
║                    LEOCODER                              ║
║           Smart LLM Router for Vibe Coding               ║
╚══════════════════════════════════════════════════════════╝

  Active Model: qwen2.5:1.5b
  Local: ✓ ollama
  Cloud: ✗ None

  Type "/help" for commands, "/stats" for usage
  Type "exit" or press Ctrl+C to quit
═══════════════════════════════════════════════════════════

┌─ You: 
└─> explain what is a closure
```

Responses are displayed in styled boxes:

```
┌───────────────────── Input ──────────────────────┐
│ YOU                                              │
│ ──────────────────────────────────────────────── │
│ explain what is a closure                        │
└──────────────────────────────────────────────────┘

┌─────────────────── Response ────────────────────┐
│ LEOCODER [LOCAL]                                │
│ ─────────────────────────────────────────────── │
│ A closure is a function that remembers its...   │
└─────────────────────────────────────────────────┘
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

## Setup Cloud Providers (FREE Keys!)

Adding cloud providers gives you smarter AI for complex tasks while still saving tokens on simple ones.

### Get FREE Groq API Key (Recommended)

1. Go to https://console.groq.com/keys
2. Create free account
3. Generate API key
4. Edit `.env` file:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```

### Get FREE Gemini API Key

1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Edit `.env` file:
   ```
   GEMINI_API_KEY=your_key_here
   ```

## How LeoCoder Saves You Tokens

The router automatically analyzes each request:

| Complexity | Route | Example | Tokens Saved |
|------------|-------|---------|--------------|
| 1-3 | 🏠 LOCAL | "complete this function" | ~100% |
| 4-5 | 🏠 LOCAL | "explain this code" | ~100% |
| 6-7 | ☁️ CLOUD | "debug this issue" | 0% |
| 8-10 | ☁️ CLOUD | "design microservice architecture" | 0% |

**Result**: 70-80% of tasks use local models = massive token savings!

## Example Session

```bash
# Start chat
npm start

# Ask a simple question (uses LOCAL)
┌─ You: 
└─> what is 2+2

# Ask for code explanation (uses LOCAL)
┌─ You: 
└─> explain this function

# Complex architecture question (uses CLOUD if configured)
┌─ You: 
└─> design a REST API for a blog
```

## Ollama Tips

If responses are slow:

1. **Keep Ollama running** in background
2. **Use smaller models**:
   ```bash
   ollama pull deepseek-coder:1.3b  # Fastest
   ollama pull qwen2.5-coder:1.5b   # Best balance
   ollama pull phi-3-mini           # Smartest but slower
   ```

## Next Steps

1. **Start chatting**: `npm start`
2. **Add cloud keys** (optional): Edit `.env` file  
3. **Customize**: Edit `config.yaml`

---

**Happy coding with LeoCoder!** 🚀
