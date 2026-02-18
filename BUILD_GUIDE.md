# Build Scripts Guide

This directory contains several batch scripts for building and running AutopilotTS on Windows.

## Available Scripts

### 🚀 Development Scripts

#### `build.bat`
Compiles TypeScript to JavaScript without packaging.
- **Use when:** You want to test changes quickly
- **Output:** `dist/` folder
- **Time:** ~10-30 seconds

```bash
build.bat
```

#### `run.bat`
Runs the already-compiled application.
- **Use when:** You've already built with `build.bat` and want to test
- **Requires:** `dist/` folder must exist
- **Time:** Instant

```bash
run.bat
```

---

### 📦 Production Scripts

#### `build-production.bat` (Recommended)
**Full production build with installer generation.**

**Steps performed:**
1. Cleans previous builds (`dist/`, `release/`)
2. Installs/updates dependencies
3. Compiles TypeScript
4. Packages with Electron Builder
5. Opens `release/` folder when done

**Use when:**
- First production build
- Major changes to dependencies
- Want to ensure clean build

**Output:**
- `release/AutopilotTS Setup [version].exe` - NSIS installer
- `release/win-unpacked/` - Portable version (no installation)

**Time:** ~5-10 minutes (depending on hardware)

```bash
build-production.bat
```

#### `build-quick.bat`
**Quick production build without cleaning.**

**Steps performed:**
1. Compiles TypeScript
2. Packages with Electron Builder

**Use when:**
- You've already built once
- Only changed source code (no dependencies)
- Want faster rebuild

**Output:** Same as `build-production.bat`

**Time:** ~2-5 minutes

```bash
build-quick.bat
```

---

## Build Comparison

| Script | Clean? | Install deps? | Compile TS? | Package? | Time | Use case |
|--------|--------|---------------|-------------|----------|------|----------|
| `build.bat` | ❌ | ❌ | ✅ | ❌ | ~30s | Quick dev testing |
| `run.bat` | ❌ | ❌ | ❌ | ❌ | <1s | Run after build |
| `build-quick.bat` | ❌ | ❌ | ✅ | ✅ | ~3min | Fast production rebuild |
| `build-production.bat` | ✅ | ✅ | ✅ | ✅ | ~8min | Clean production build |

---

## Typical Workflows

### Workflow 1: Development Testing
```bash
# 1. Make code changes
# 2. Build quickly
build.bat

# 3. Test the app
run.bat

# 4. Repeat as needed
```

### Workflow 2: First Production Build
```bash
# Clean build with everything
build-production.bat

# Output: release/AutopilotTS Setup 0.1.5.exe
```

### Workflow 3: Quick Production Update
```bash
# 1. Make code changes
# 2. Quick rebuild
build-quick.bat

# Output: Updated installer in release/
```

---

## Output Structure

After running production scripts, you'll have:

```
release/
├── AutopilotTS Setup 0.1.5.exe    # Installer (NSIS)
├── win-unpacked/                  # Portable version
│   ├── AutopilotTS.exe           # Main executable
│   ├── resources/
│   └── ...
└── builder-effective-config.yaml  # Build configuration
```

### Installer vs Portable

**Installer (.exe):**
- Install to Program Files
- Creates desktop shortcut
- Adds to Start Menu
- Registers uninstaller
- ~80-120 MB

**Portable (win-unpacked/):**
- No installation required
- Run directly from any folder
- Can be on USB drive
- Same functionality
- ~150-200 MB (uncompressed)

---

## Troubleshooting

### "ERROR: Build failed!"
**Common causes:**
- Node.js not installed or wrong version (need 20+)
- Missing dependencies: Run `npm install`
- TypeScript errors: Check console output

**Fix:**
```bash
npm install
npm run build
```

### "ERROR: Electron packaging failed!"
**Common causes:**
- Missing `dist/` folder
- Corrupted node_modules
- Antivirus blocking Electron Builder

**Fix:**
```bash
# Clean everything
rmdir /s /q dist
rmdir /s /q release
rmdir /s /q node_modules

# Reinstall
npm install

# Try again
build-production.bat
```

### "Application not built!"
This means you tried to run `run.bat` without building first.

**Fix:**
```bash
build.bat
run.bat
```

### Build is very slow
**Normal:** First build takes 5-10 minutes
- Electron Builder downloads native dependencies
- Creates NSIS installer
- Compresses files

**Use `build-quick.bat` for subsequent builds** (~2-3 minutes)

---

## Advanced: npm Commands

All .bat scripts are wrappers around npm commands. You can use npm directly:

```bash
# Development
npm run build        # Compile only
npm run watch        # Auto-recompile on changes
npm start            # Run app

# Production
npm run pack         # Build without installer (faster)
npm run dist         # Full build with installer
npm run dist -- --win --x64  # Windows 64-bit only
```

---

## Platform-Specific Builds

While these scripts are for Windows, you can build for other platforms:

```bash
# macOS (from Mac or with CI/CD)
npm run dist -- --mac

# Linux (from Linux or with CI/CD)
npm run dist -- --linux

# All platforms (requires proper setup)
npm run dist -- --win --mac --linux
```

**Note:** Cross-platform builds are complex. Usually you build on the target platform.

---

## CI/CD Integration

For GitHub Actions or other CI/CD:

```yaml
# .github/workflows/build.yml
- name: Build Windows installer
  run: npm run dist -- --win --x64
  
- name: Upload artifacts
  uses: actions/upload-artifact@v3
  with:
    name: windows-installer
    path: release/*.exe
```

---

## File Sizes

**Expected sizes:**
- Source (`src/`): ~500 KB
- Compiled (`dist/`): ~1.5 MB
- node_modules: ~250 MB
- Installer: ~80-120 MB
- Unpacked: ~150-200 MB

---

## Need Help?

1. Check error messages in console
2. Enable debug mode in app config
3. Review `release/builder-debug.yml`
4. Check [Electron Builder docs](https://www.electron.build/)

---

**Happy building! 🚀**
