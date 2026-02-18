# Quick Reference Card - Build Scripts

## 🎯 Which script should I use?

```
┌─────────────────────────────────────────────────────────────┐
│  NEED                           → USE THIS SCRIPT           │
├─────────────────────────────────────────────────────────────┤
│  Test code changes quickly      → build.bat + run.bat       │
│  First production build         → build-production.bat      │
│  Update after code changes      → build-quick.bat           │
│  Just run (already built)       → run.bat                   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Production Build Scripts

### build-production.bat
```
🕐 Time: ~8 minutes
📁 Output: release/AutopilotTS Setup 0.1.5.exe
✅ Cleans everything first
✅ Installs dependencies
✅ Full rebuild
✅ Creates installer
✅ Opens release folder

When to use:
  ✓ First build
  ✓ After updating dependencies
  ✓ Before releasing new version
  ✓ When something is broken
```

### build-quick.bat
```
🕐 Time: ~3 minutes
📁 Output: release/AutopilotTS Setup 0.1.5.exe
⚠️  No clean (faster but may have issues)
⚠️  Doesn't install dependencies

When to use:
  ✓ Quick code changes
  ✓ Testing iterations
  ✓ No dependency changes
```

## 🔧 Development Scripts

### build.bat
```
🕐 Time: ~30 seconds
📁 Output: dist/ folder
❌ No installer created

When to use:
  ✓ Testing during development
  ✓ Quick compilation check
```

### run.bat
```
🕐 Time: <1 second
📁 Requires: dist/ folder
❌ Doesn't compile

When to use:
  ✓ After build.bat
  ✓ Quick app launch
```

## 📂 Output Structure

```
📦 AutopilotTS/
├── 📁 dist/                         # Compiled TypeScript (from build.bat)
│   ├── electron-main.js
│   ├── utils/
│   └── ...
│
└── 📁 release/                      # Production builds (from build-production.bat)
    ├── AutopilotTS Setup 0.1.5.exe  ← Installer (80-120 MB)
    ├── win-unpacked/                ← Portable version (150-200 MB)
    │   ├── AutopilotTS.exe
    │   └── resources/
    └── ...
```

## 💡 Common Workflows

### Workflow A: "I'm developing"
```bash
# 1. Make changes to src/
# 2. Quick compile
build.bat

# 3. Test
run.bat

# 4. Repeat
```

### Workflow B: "First production build"
```bash
build-production.bat
# Wait 8 minutes ☕
# Done! Installer in release/
```

### Workflow C: "Update production build"
```bash
# After changing code
build-quick.bat
# Wait 3 minutes
# Updated installer ready!
```

## ⚠️ Common Errors

### "Application not built!"
```bash
# You tried to run without building
# Solution:
build.bat
run.bat
```

### "Build failed!"
```bash
# Probably TypeScript errors
# Check console, fix code, try again
```

### "Electron packaging failed!"
```bash
# Nuclear option:
rmdir /s /q node_modules
rmdir /s /q dist
rmdir /s /q release
npm install
build-production.bat
```

## 📊 Build Time Comparison

| Script | Time | Clean | Package | Use Case |
|--------|------|-------|---------|----------|
| build.bat | 30s | ❌ | ❌ | Dev testing |
| run.bat | <1s | ❌ | ❌ | Run only |
| build-quick.bat | 3min | ❌ | ✅ | Quick update |
| build-production.bat | 8min | ✅ | ✅ | Official build |

## 🎁 What You Get

### NSIS Installer (.exe)
```
✅ Professional installer
✅ Start menu shortcut
✅ Desktop shortcut
✅ Uninstaller
✅ Auto-update support (future)
✅ ~80-120 MB
```

### Portable (win-unpacked/)
```
✅ No installation needed
✅ Run from any folder
✅ USB-friendly
✅ Same features
✅ ~150-200 MB
```

## 🚀 Quick Start

**First time building for production?**
```bash
build-production.bat
```

**Already built and just changed code?**
```bash
build-quick.bat
```

**Just testing during development?**
```bash
build.bat
run.bat
```

## 📝 Tips

1. **Use build-quick.bat** for iterations (much faster)
2. **Use build-production.bat** before releasing
3. **Always test the installer** on a clean machine
4. **Portable version** is great for testing without installation
5. **First build is slow** (~8 min), subsequent builds are faster (~3 min)

---

See **BUILD_GUIDE.md** for detailed documentation.
