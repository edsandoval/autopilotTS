# autopilotTS - AI-Powered Ticket Resolution System

This is a TypeScript CLI tool for managing and automatically resolving development tickets using GitHub Copilot SDK.

## Build, Test, and Lint

```bash
# Development
npm run dev              # Run with tsx (no build needed)

# Build
npm run build            # Compile TypeScript to dist/
npm run watch            # Watch mode with incremental compilation

# Start (after building)
npm start                # Run compiled version from dist/

# Testing
# ⚠️ No test suite currently implemented
```

## High-Level Architecture

### Core Components

**CLI Entry Point** (`src/index.ts`)
- Interactive REPL mode and direct command execution
- Uses commander.js for command parsing
- Delegates to command handlers in `src/commands/`

**5-Agent Resolution System** (`src/agents/`)
The system orchestrates 5 specialized AI agents via `TicketResolver`:

1. **CodeExplorerAgent** - Searches codebase using fast-glob, extracts keywords from ticket descriptions, ranks files by relevance
2. **CodeAnalyzerAgent** - Reads files, detects dependencies, identifies architectural patterns
3. **PlannerAgent** - Generates step-by-step implementation plans via GitHub Copilot SDK
4. **ImplementerAgent** - Applies changes (create/modify/delete files) using Copilot SDK for code generation
5. **ValidatorAgent** - Runs npm build/test commands to verify changes

**Resolution Flow:**
```
Ticket → Explorer → Analyzer → Planner → Implementer → Validator → ✓
```

**Utility Modules** (`src/utils/`)
- `storage.ts` - Manages `.autopilot.json` (ticket data) and `.autopilot.config.json` (project path)
- `git.ts` - Handles branching, pulling, committing via simple-git
- `copilot.ts` - Wraps `@github/copilot-sdk` with streaming/message handling
- `display.ts` - Terminal UI formatting with chalk/figlet/cli-table3
- `config.ts` - Project path configuration management

### Data Flow

1. User creates ticket → Stored in `.autopilot.json`
2. User starts ticket → Git branch created → Status: `working`
3. Resolution modes:
   - **Automatic**: All 5 agents run sequentially, apply changes
   - **Plan Only**: Run Explorer → Analyzer → Planner, stop before implementation
   - **Interactive**: Legacy chat-based mode with Copilot SDK
4. User stops ticket → Optionally commit changes → Return to base branch

### Configuration Files

- `.autopilot.config.json` (in execution directory) - Contains `projectPath` and `debug` flag
- `.autopilot.json` (in project directory) - Stores ticket array and last ID counter
- If `projectPath` is set, all operations execute in that directory

## Key Conventions

### Ticket Status Lifecycle
States: `pending` → `branching` → `working` → `stopped`/`closed`/`error`

### Git Branch Naming
Format: `copilot/{TICKET-ID}` (e.g., `copilot/TASK-001`)
Base branch: `develop` (customizable via `DEFAULT_BRANCH` env var)

### Agent Communication Pattern
All agents share `AgentContext` containing:
- `ticket` - Current ticket object
- `projectPath` - Target project directory
- `debugMode` - Whether to log verbose output

Each agent returns a typed result (`ExplorerResult`, `AnalyzerResult`, etc.) with:
- `success: boolean`
- Agent-specific data
- Optional `error: string`

Results are passed sequentially through the pipeline.

### File Operations in ImplementerAgent
- Always creates backups before modifications (`.bak` extension)
- Uses Copilot SDK prompts for generating file content
- Supports 3 operations: `create`, `modify`, `delete`
- Tracks changes in `FileChange[]` array

### Copilot SDK Integration
- Uses GitHub CLI authentication (`gh auth login`) - no manual token needed
- `copilot.ts` wraps SDK with message/tool streaming
- Debug mode shows request/response payloads in terminal (gray text)
- Agent prompts include: ticket description, file contents, architecture analysis

### Import File Format
For bulk ticket imports, expects markdown with this structure:
```markdown
## TICKET-ID
**Description:**
Multi-line description here.
---
```
Parsed by regex, creates tickets with status `pending`.

## Development Notes

### Working with Agents

When modifying agents:
- Update `src/agents/types.ts` if changing result structures
- Agent methods should be async and handle errors gracefully
- TicketResolver orchestrates execution order - modify there for pipeline changes

### Adding New Commands

1. Add handler to `src/commands/index.ts`
2. Register in commander.js (see `src/index.ts`)
3. Update interactive REPL switch statement if needed

### Debugging

Enable verbose output:
```bash
autopilot config debug on
```

Shows:
- Copilot SDK requests/responses
- Agent execution logs
- File operations
- Git commands

### TypeScript Configuration

- Target: ES2020 with ES modules
- Strict mode enabled
- Output: `dist/` directory with declaration maps
- Root: `src/` only

### Module Resolution

This project uses ES modules (`"type": "module"` in package.json):
- All imports must include `.js` extension (even for `.ts` files)
- Use `import type` for type-only imports to avoid circular dependencies

### Bin Script

The CLI is executable via `autopilot` after `npm link`:
- Entry point: `dist/index.js`
- Must have shebang: `#!/usr/bin/env node`
