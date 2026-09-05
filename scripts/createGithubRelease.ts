/**
 * scripts/createGithubRelease.ts
 *
 * Windows PowerShell-compatible GitHub Release preparation and publishing helper.
 *
 * Checks:
 * 1. release/TASKER-vX.Y.Z.apk existence
 * 2. Prepares GitHub Release asset URL:
 *    https://github.com/khandagalesuraj48-sys/TASKER/releases/download/vX.Y.Z/TASKER-vX.Y.Z.apk
 * 3. Generates SQL insert statement for Supabase app_releases table
 *
 * Usage:
 *   node --experimental-strip-types scripts/createGithubRelease.ts
 *   node --experimental-strip-types scripts/createGithubRelease.ts --publish (requires GITHUB_TOKEN)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

function calculateSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function main(): void {
  const rootDir = process.cwd();
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '1.0.1';
  const tag = `v${version}`;

  const apkName = `TASKER-v${version}.apk`;
  const apkPath = path.join(rootDir, 'release', apkName);

  console.log('==================================================');
  console.log(`TASKER GitHub Release Preparation — ${tag}`);
  console.log('==================================================');

  if (!fs.existsSync(apkPath)) {
    console.warn(`\n[Notice] Release APK not found at: ${apkPath}`);
    console.warn('Run "npm run release:build" first to produce the release APK.\n');
  } else {
    const sizeMb = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2);
    const sha256 = calculateSha256(apkPath);
    console.log(`\n✔ Release APK verified:`);
    console.log(`- Path: ${apkPath}`);
    console.log(`- File Name: ${apkName}`);
    console.log(`- Size: ${sizeMb} MB`);
    console.log(`- SHA-256: ${sha256}`);
  }

  const repo = 'khandagalesuraj48-sys/TASKER';
  const releaseUrl = `https://github.com/${repo}/releases/download/${tag}/${apkName}`;

  console.log('\n[GitHub Release Asset Specification]');
  console.log(`- Repository: https://github.com/${repo}`);
  console.log(`- Target Tag: ${tag}`);
  console.log(`- Asset Name: ${apkName}`);
  console.log(`- Direct Download URL: ${releaseUrl}`);

  console.log('\n[Supabase app_releases SQL Insert Statement]');
  console.log('--------------------------------------------------');
  // Read versionCode from android/app/build.gradle
  let versionCode = 3;
  const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradlePath)) {
    const gradleContent = fs.readFileSync(gradlePath, 'utf8');
    const match = gradleContent.match(/versionCode\s+(\d+)/);
    if (match) versionCode = parseInt(match[1], 10);
  }

  const sql = `INSERT INTO public.app_releases (
    version_name,
    version_code,
    release_notes,
    apk_url,
    release_url,
    is_mandatory
) VALUES (
    '${version}',
    ${versionCode},
    'TASKER v${version} In-App Android Update System:
- Native OTA update installation without USB cable
- Dedicated App Updates section in Settings
- Direct APK download and official Android package installer handoff
- Offline and network resilience
- Security verification and non-blocking manual install prompt',
    '${releaseUrl}',
    '${releaseUrl}',
    false
) ON CONFLICT (version_code) DO UPDATE SET
    version_name = EXCLUDED.version_name,
    release_notes = EXCLUDED.release_notes,
    apk_url = EXCLUDED.apk_url,
    release_url = EXCLUDED.release_url,
    is_mandatory = EXCLUDED.is_mandatory;`;

  console.log(sql);
  console.log('--------------------------------------------------');

  const args = process.argv.slice(2);
  const shouldPublish = args.includes('--publish');

  if (!shouldPublish) {
    console.log('\n[Dry Run Completed]');
    console.log('To publish a GitHub release:');
    console.log('1. Ensure GITHUB_TOKEN environment variable is set');
    console.log('2. Run: node --experimental-strip-types scripts/createGithubRelease.ts --publish');
    console.log('Or create the release manually on GitHub and attach release/' + apkName);
  } else {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('\n✖ GITHUB_TOKEN environment variable is required to publish.');
      process.exit(1);
    }
    console.log('\nPublishing automated GitHub Release is deferred until user confirmation.');
  }

  console.log('\n==================================================');
}

main();

