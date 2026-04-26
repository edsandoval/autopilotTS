import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Helper class responsible for handling the concept of a "project" within
 * the Autopilot directory.  Each project gets its own subdirectory under
 * ~/.autopilot (or a custom location when the AUTOPILOT_DIR env var is set).
 *
 * The folder name is the base64 encoding of the project display name so we
 * can safely store names with spaces, accents, etc.  When listing projects
 * the encoded directory names are decoded back into their original form.
 *
 * An "active" project may be persisted to disk so that the application
 * automatically re‑opens the last selected project on startup.
 */
export class ProjectManager {
  /**
   * Returns the root Autopilot folder (~/.autopilot by default or overridden
   * with AUTOPILOT_DIR). The directory is created automatically if missing.
   */
  static getAutopilotDir(): string {
    const override = process.env.AUTOPILOT_DIR;
    const base = override ? override : os.homedir();
    const autopilotDir = override ? override : path.join(base, '.autopilot');

    if (!fs.existsSync(autopilotDir)) {
      fs.mkdirSync(autopilotDir, { recursive: true });
    }
    return autopilotDir;
  }

  static encodeName(name: string): string {
    return Buffer.from(name, 'utf8').toString('base64');
  }

  static decodeName(encoded: string): string {
    try {
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
      // if not valid base64 just return the original string so callers
      // can still work with arbitrary folder names (e.g. older installs)
      return encoded;
    }
  }

  static isEncoded(str: string): boolean {
    try {
      return Buffer.from(Buffer.from(str, 'base64').toString('utf8'), 'utf8').toString('base64') === str;
    } catch {
      return false;
    }
  }

  /**
   * Returns the physical path for a given project name (either encoded or
   * human readable).  The directory is created if it does not already exist.
   */
  static getProjectDir(name: string): string {
    const encoded = this.isEncoded(name) ? name : this.encodeName(name);
    const dir = path.join(this.getAutopilotDir(), encoded);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // ensure the project has the minimal file layout
    this.ensureProjectStructure(dir);
    return dir;
  }

  /**
   * List all known project display names.
   */
  static listProjects(): string[] {
    const root = this.getAutopilotDir();
    if (!fs.existsSync(root)) return [];

    // migrate any legacy files from root into a default project
    this.migrateLegacy(root);

    const children = fs.readdirSync(root, { withFileTypes: true });
    return children
      .filter(c => c.isDirectory())
      .map(d => this.decodeName(d.name));
  }

  static getActiveProjectFile(): string {
    return path.join(this.getAutopilotDir(), 'active_project.txt');
  }

  /**
   * If the root contains tickets.json or config.json (legacy layout), move
   * them into a default project so that the new multi-project structure
   * can work without data loss. This runs before listing projects.
   */
  private static migrateLegacy(root: string): void {
    const legacyFiles = ['tickets.json', 'config.json'];
    const hasLegacy = legacyFiles.some(f => fs.existsSync(path.join(root, f)));
    if (!hasLegacy) return;

    const defaultName = 'default';
    const targetDir = this.getProjectDir(defaultName);

    legacyFiles.forEach(f => {
      const src = path.join(root, f);
      const dest = path.join(targetDir, f);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        try {
          fs.renameSync(src, dest);
          console.log(`[ProjectManager] Migrated ${f} into project "${defaultName}"`);
        } catch (e) {
          console.warn(`[ProjectManager] Failed to migrate ${f}:`, e);
        }
      }
    });

    // after migrating make default project active so UI skips forced selection
    this.setActiveProject(defaultName);
  }

  static getActiveProject(): string | undefined {
    const file = this.getActiveProjectFile();
    if (!fs.existsSync(file)) return undefined;
    try {
      const encoded = fs.readFileSync(file, 'utf8').trim();
      if (!encoded) return undefined;
      return this.decodeName(encoded);
    } catch {
      return undefined;
    }
  }

  static setActiveProject(name: string): void {
    const encoded = this.encodeName(name);
    // ensure project directory exists
    this.getProjectDir(name);
    fs.writeFileSync(this.getActiveProjectFile(), encoded, 'utf8');
  }

  /**
   * Create a new project and set it as active.  If the project already exists
   * we simply switch to it.
   */
  static createProject(name: string): void {
    const dir = this.getProjectDir(name);
    // we don't override existing files, but ensure minimal structure
    this.ensureProjectStructure(dir);
    this.setActiveProject(name);
  }

  static deleteProject(name: string): void {
    const encoded = this.isEncoded(name) ? name : this.encodeName(name);
    const dir = path.join(this.getAutopilotDir(), encoded);
    if (!fs.existsSync(dir)) {
      throw new Error(`Project "${name}" not found`);
    }
    // Clear active project if it's the one being deleted
    const active = this.getActiveProject();
    if (active === name) {
      const activeFile = this.getActiveProjectFile();
      if (fs.existsSync(activeFile)) {
        fs.unlinkSync(activeFile);
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  private static ensureProjectStructure(dir: string): void {
    // prompts directory
    const promptsDir = path.join(dir, 'prompts');
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }
    // config.json and tickets.json will be lazily created by ConfigManager/Storage
  }
}
