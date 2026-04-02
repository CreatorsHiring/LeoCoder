# Contributing to LeoCoder

Thanks for your interest in contributing to LeoCoder! This guide will help you get started.

## 🎯 Project Goal

LeoCoder is a **smart LLM router for vibe coding** designed to work on low-end PCs by prioritizing local AI models with optional cloud fallback.

## 🚀 Quick Start for Contributors

### 1. Fork and Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/LeoCoder.git
cd LeoCoder
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

```bash
# Copy example env file
copy .env.example .env

# Edit .env and add your API keys (optional for development)
```

### 4. Build and Run

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Or test the built version
npm start
```

## 📦 Development Workflow

### Making Changes

1. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the `src/` directory

3. **Build and test**:
   ```bash
   npm run build
   npm start
   ```

4. **Test from another directory** (important!):
   ```bash
   npm link
   cd ..
   mkdir test-project
   cd test-project
   leocoder
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

6. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Consistent indentation (2 spaces)
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Comments**: Only for complex logic, focus on _why_ not _what_

### Commit Message Convention

We use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test additions
- `chore:` - Build/config changes

Example:
```
feat: add streaming support for cloud providers
fix: resolve file path issue on Windows
docs: update README with installation instructions
```

## 🧪 Testing

### Manual Testing Checklist

For any PR, test:

- [ ] `leocoder` starts chat session
- [ ] `leocoder ask "question"` works
- [ ] `leocoder status` shows providers
- [ ] File writing works (auto-write from code blocks)
- [ ] `/file`, `/read`, `/search`, `/run` commands work
- [ ] Local models (Ollama) work
- [ ] Cloud providers work (if API keys provided)
- [ ] Works on Windows (if applicable)
- [ ] Works from any directory (global install)

### Testing on Low-End PCs

If possible, test on:

- 4GB RAM machine
- No dedicated GPU
- Older CPU (pre-2020)

Ensure:
- Small models (1-3B) work well
- CPU inference is usable
- Memory usage is reasonable

## 📁 Project Structure

```
LeoCoder/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── context/
│   │   ├── initContext.ts    # Initialize project context
│   │   └── loadContext.ts    # Load context for prompts
│   ├── providers/
│   │   ├── base.ts           # Base provider interface
│   │   ├── ollama.ts         # Ollama provider
│   │   ├── lmstudio.ts       # LM Studio provider
│   │   ├── groq.ts           # Groq cloud provider
│   │   └── gemini.ts         # Gemini cloud provider
│   ├── tools/
│   │   ├── filesystem.ts     # File operations
│   │   └── shell.ts          # Shell command execution
│   └── utils/
│       ├── router.ts         # Smart routing logic
│       ├── classifier.ts     # Task classification
│       └── token-tracker.ts  # Token usage tracking
├── config.yaml               # Default configuration
├── package.json
└── README.md
```

## 🛠️ Common Tasks

### Adding a New Provider

1. Create `src/providers/your-provider.ts`
2. Extend `LLMProvider` base class
3. Implement required methods:
   - `isAvailable()`
   - `generate()`
   - `generateStream()`
   - `listModels()`
4. Export in `src/providers/index.ts`
5. Add to router in `src/index.ts`

### Adding a New Command

1. Add to Commander program in `src/index.ts`
2. Implement handler function
3. Add to help text
4. Test with `npm run dev`

### Modifying Routing Logic

Edit `src/utils/classifier.ts`:
- Add new task types
- Adjust complexity thresholds
- Add keywords for detection

## 🐛 Reporting Bugs

### Before Submitting

- [ ] Check existing issues
- [ ] Try latest version
- [ ] Gather error messages/logs

### Bug Report Template

```markdown
**Describe the bug**
Clear description of what's wrong

**To Reproduce**
Steps to reproduce:
1. Run `leocoder`
2. Type '...'
3. See error

**Expected behavior**
What should happen

**Screenshots/Error Logs**
If applicable

**Environment:**
- OS: [Windows/Mac/Linux]
- Node version: `node -v`
- LeoCoder version: `leocoder --version`
- Model: [ollama/qwen2.5, etc.]
```

## 💡 Feature Requests

### Before Submitting

- [ ] Check existing feature requests
- [ ] Ensure it aligns with project goals
- [ ] Consider implementation complexity

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other solutions you thought of

**Additional context**
Any other info, mockups, etc.
```

## 📝 Documentation

When adding features, update:

- [ ] README.md - Usage examples
- [ ] USAGE.md - Command reference
- [ ] Inline code comments - Complex logic
- [ ] TypeScript types - Proper typing

## 🚢 Release Process

Releases are managed by maintainers:

1. Version bump: `npm version minor`
2. Update CHANGELOG.md
3. Push tags: `git push --follow-tags`
4. Publish: `npm publish`
5. Create GitHub release

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome contributors of all skill levels
- Help others learn
- Focus on constructive feedback
- Keep discussions on-topic

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Twitter**: [@yourhandle] for updates

## 🎯 Areas Needing Help

Priority areas for contributions:

- [ ] **Testing**: Unit tests for router/classifier
- [ ] **Documentation**: Tutorials and examples
- [ ] **Performance**: Optimize for lower RAM usage
- [ ] **Providers**: Add support for more local AI providers
- [ ] **UI/UX**: Better terminal UI
- [ ] **Accessibility**: Improve for diverse users

## ✅ PR Review Process

1. **Submit PR** with clear description
2. **Automated checks** pass (build, lint)
3. **Maintainer review** within 1 week
4. **Address feedback** if requested
5. **Merge** by maintainer

## 🙏 Thank You!

Every contribution helps make LeoCoder better for developers worldwide, especially those with low-end hardware.

**Happy coding! 🚀**

---

Questions? Open an issue or reach out on Twitter.
