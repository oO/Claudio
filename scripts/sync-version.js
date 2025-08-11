#!/usr/bin/env node

/**
 * Version Sync Script
 * 
 * Syncs version from package.json (single source of truth) to Cargo.toml
 * This ensures version consistency across the Tauri application
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = new URL('..', import.meta.url).pathname;
const PACKAGE_JSON_PATH = join(ROOT_DIR, 'package.json');
const CARGO_TOML_PATH = join(ROOT_DIR, 'src-backend', 'Cargo.toml');

function syncVersion() {
  try {
    // Read version from package.json (single source of truth)
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    const version = packageJson.version;
    
    if (!version) {
      throw new Error('No version found in package.json');
    }
    
    console.log(`📦 Source version (package.json): ${version}`);
    
    // Read Cargo.toml
    let cargoToml = readFileSync(CARGO_TOML_PATH, 'utf8');
    
    // Update version in Cargo.toml using regex
    const versionRegex = /^version\s*=\s*"[^"]*"$/m;
    const newVersionLine = `version = "${version}"`;
    
    if (versionRegex.test(cargoToml)) {
      cargoToml = cargoToml.replace(versionRegex, newVersionLine);
      console.log(`🔄 Updated Cargo.toml version to: ${version}`);
    } else {
      throw new Error('Could not find version line in Cargo.toml');
    }
    
    // Write updated Cargo.toml
    writeFileSync(CARGO_TOML_PATH, cargoToml, 'utf8');
    
    console.log('✅ Version sync completed successfully');
    
  } catch (error) {
    console.error('❌ Version sync failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncVersion();
}

export { syncVersion };