import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs, { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from '../utils/config.js';
import { ProjectManager } from '../utils/project.js';
import type { ProjectConfig } from '../types/index.js';

// many of the config routines now rely on an "active" project, so the
// tests create a temporary autopilot root and ensure a project is selected
// before exercising ConfigManager behaviour.

describe('Config & ProjectManager - project aware file ops', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `autopilot-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.env.AUTOPILOT_DIR = testDir;
  });

  afterEach(() => {
    delete process.env.AUTOPILOT_DIR;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('ProjectManager should list and create projects', () => {
    // initially no projects
    expect(ProjectManager.listProjects()).toEqual([]);

    // create one
    ProjectManager.createProject('MyProject');
    expect(ProjectManager.listProjects()).toEqual(['MyProject']);
    expect(ProjectManager.getActiveProject()).toBe('MyProject');

    // creating again just switches
    ProjectManager.createProject('MyProject');
    expect(ProjectManager.listProjects()).toEqual(['MyProject']);
    expect(ProjectManager.getActiveProject()).toBe('MyProject');

    // create a second project
    ProjectManager.createProject('Another');
    expect(ProjectManager.listProjects().sort()).toEqual(['Another', 'MyProject']);
    expect(ProjectManager.getActiveProject()).toBe('Another');
  });

  it('ConfigManager should read/write inside active project', () => {
    ProjectManager.createProject('Foo');

    // config file path under project should exist after getConfig
    const cfg = ConfigManager.getConfig();
    expect(cfg.baseBranch).toBeDefined();

    cfg.debug = true;
    ConfigManager.saveConfig(cfg);

    const reloaded = ConfigManager.getConfig();
    expect(reloaded.debug).toBe(true);

    // verify that another project has its own config file
    ProjectManager.createProject('Bar');
    const cfg2 = ConfigManager.getConfig();
    expect(cfg2.debug).not.toBe(true);
  });

  it('should migrate legacy root files into default project', () => {
    // create legacy files in root autopilot directory
    const root = ProjectManager.getAutopilotDir();
    const cfgPath = join(root, 'config.json');
    const ticketsPath = join(root, 'tickets.json');
    // ensure clean
    if (existsSync(cfgPath)) rmSync(cfgPath);
    if (existsSync(ticketsPath)) rmSync(ticketsPath);

    // write simple objects
    fs.writeFileSync(cfgPath, JSON.stringify({ debug: true }));
    fs.writeFileSync(ticketsPath, JSON.stringify({ tickets: [], lastId: 0 }));

    // listing projects should trigger migration
    const projects = ProjectManager.listProjects();
    expect(projects).toContain('default');
    expect(ProjectManager.getActiveProject()).toBe('default');

    // after migration the root files should be gone
    expect(existsSync(cfgPath)).toBe(false);
    expect(existsSync(ticketsPath)).toBe(false);

    // the files should now exist under default project
    const defaultDir = ProjectManager.getProjectDir('default');
    expect(existsSync(join(defaultDir, 'config.json'))).toBe(true);
    expect(existsSync(join(defaultDir, 'tickets.json'))).toBe(true);
  });

  it('ConfigManager defaults include ticket types', () => {
    ProjectManager.createProject('TypeCheck');
    const types = ConfigManager.getTicketTypes();
    expect(types.bug).toContain('BUG FIX');
    expect(types.codeReview).toContain('CODE REVIEW');
  });
});
