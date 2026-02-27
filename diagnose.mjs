#!/usr/bin/env node
/**
 * Diagnostic Script for AutopilotTS File Reading
 * 
 * This script tests file reading from ~/.autopilot directory
 * to help diagnose any issues with ticket and config loading.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================');
console.log('AutopilotTS - Diagnostic Test');
console.log('========================================\n');

// 1. Check system info
console.log('1. System Information:');
console.log('   OS:', os.platform(), os.release());
console.log('   Node Version:', process.version);
console.log('   User Home:', os.homedir());
console.log('');

// 2. Check ~/.autopilot directory (or override via AUTOPILOT_DIR)
const autopilotDir = process.env.AUTOPILOT_DIR || path.join(os.homedir(), '.autopilot');
console.log('2. Autopilot Directory:');
console.log('   Path:', autopilotDir);
console.log('   Exists:', fs.existsSync(autopilotDir) ? '✓ Yes' : '✗ No');

if (fs.existsSync(autopilotDir)) {
  const files = fs.readdirSync(autopilotDir);
  console.log('   Contents:', files.join(', ') || '(empty)');
  if (files.length > 0) {
    console.log('   (these may be project folders encoded in base64)');
  }
}
console.log('');

// 3. Check config.json
const configFile = path.join(autopilotDir, 'config.json');
console.log('3. Configuration File (config.json):');
console.log('   Path:', configFile);
console.log('   Exists:', fs.existsSync(configFile) ? '✓ Yes' : '✗ No');

if (fs.existsSync(configFile)) {
  try {
    const configData = fs.readFileSync(configFile, 'utf-8');
    const config = JSON.parse(configData);
    console.log('   Size:', configData.length, 'bytes');
    console.log('   Valid JSON: ✓ Yes');
    console.log('   Keys:', Object.keys(config).join(', '));
    console.log('   Content Preview:');
    console.log('     - Debug:', config.debug);
    console.log('     - Base Branch:', config.baseBranch || '(not set)');
    console.log('     - Copilot Model:', config.copilotModel || '(not set)');
    console.log('     - Base Repository Path:', config.baseRepositoryPath || '(not set)');
    console.log('     - Automation Path:', config.automationPath || '(not set)');
  } catch (error) {
    console.log('   ✗ Error reading/parsing:', error.message);
  }
}
console.log('');

// 4. Check tickets.json
const ticketsFile = path.join(autopilotDir, 'tickets.json');
console.log('4. Tickets File (tickets.json):');
console.log('   Path:', ticketsFile);
console.log('   Exists:', fs.existsSync(ticketsFile) ? '✓ Yes' : '✗ No');

if (fs.existsSync(ticketsFile)) {
  try {
    const ticketsData = fs.readFileSync(ticketsFile, 'utf-8');
    const tickets = JSON.parse(ticketsData);
    console.log('   Size:', ticketsData.length, 'bytes');
    console.log('   Valid JSON: ✓ Yes');
    console.log('   Ticket Count:', tickets.tickets?.length || 0);
    console.log('   Last ID:', tickets.lastId);
    
    if (tickets.tickets && tickets.tickets.length > 0) {
      console.log('   First 3 tickets:');
      tickets.tickets.slice(0, 3).forEach((ticket, i) => {
        console.log(`     ${i + 1}. ${ticket.id} (${ticket.status})`);
      });
    }
  } catch (error) {
    console.log('   ✗ Error reading/parsing:', error.message);
  }
}
console.log('');

// 5. Test with actual Storage and ConfigManager classes
console.log('5. Testing with AutopilotTS Classes:');
try {
  const { Storage } = await import('./dist/utils/storage.js');
  const { ConfigManager } = await import('./dist/utils/config.js');
  
  console.log('   Storage.getAllTickets():');
  try {
    const tickets = Storage.getAllTickets();
    console.log('     ✓ Success - Retrieved', tickets.length, 'tickets');
  } catch (error) {
    console.log('     ✗ Error:', error.message);
  }
  
  console.log('   ConfigManager.getConfig():');
  try {
    const config = ConfigManager.getConfig();
    console.log('     ✓ Success - Config loaded');
    console.log('     - Base Repository Path:', config.baseRepositoryPath || '(not set)');
  } catch (error) {
    console.log('     ✗ Error:', error.message);
  }
} catch (error) {
  console.log('   ✗ Error loading classes:', error.message);
  console.log('   (Make sure you run "npm run build" first)');
}
console.log('');

// 6. Summary
console.log('========================================');
console.log('Summary:');
console.log('========================================');
console.log('If all checks show ✓, the file reading is working correctly.');
console.log('If you see ✗ errors, please share this output for debugging.');
console.log('');
console.log('To run the Electron app with console output:');
console.log('  npm start');
console.log('');
console.log('Then open DevTools (Ctrl+Shift+I) to see console logs.');
console.log('========================================');
