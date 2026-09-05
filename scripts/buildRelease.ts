/**
 * scripts/buildRelease.ts
 *
 * Windows PowerShell-compatible release build automation script.
 * Runs:
 * 1. npm run build (Vite frontend production bundle)
 * 2. npx cap sync android (Capacitor asset synchronization)
 * 3. .\gradlew.bat assembleRelease (Android release APK compilation)
 * 4. Checks signing and copies final APK to release/TASKER-vX.Y.Z.apk
 *
 * Usage:
 *   node --experimental-strip-types scripts/buildRelease.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

function run(command: string, cwd = process.cwd()): void {
  console.log(`\n> ${command} (in ${cwd})`);
  execSync(command, { cwd, stdio: 'inherit', shell: 'powershell.exe' });
}

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

  console.log('==================================================');
  console.log(`TASKER Android Release Build Workflow — v${version}`);
  console.log('==================================================');

  // 1. Build Web Assets
  console.log('\n[Step 1/4] Compiling frontend production bundle...');
  run('npm.cmd run build', rootDir);

  // 2. Sync Capacitor
  console.log('\n[Step 2/4] Syncing Capacitor Android assets...');
  run('npx.cmd cap sync android', rootDir);

  // 3. Assemble Release via Windows Gradle Wrapper
  console.log('\n[Step 3/4] Assembling Android release APK via gradlew.bat...');
  const androidDir = path.join(rootDir, 'android');
  run('.\\gradlew.bat assembleRelease -x lint', androidDir);

  // 4. Verify Output APK
  console.log('\n[Step 4/4] Verifying generated APK output...');
  const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
  const signedApk = path.join(apkDir, 'app-release.apk');
  const unsignedApk = path.join(apkDir, 'app-release-unsigned.apk');

  const releaseOutDir = path.join(rootDir, 'release');
  if (!fs.existsSync(releaseOutDir)) {
    fs.mkdirSync(releaseOutDir, { recursive: true });
  }

  const targetApkName = `TASKER-v${version}.apk`;
  const targetApkPath = path.join(releaseOutDir, targetApkName);

  if (fs.existsSync(signedApk)) {
    fs.copyFileSync(signedApk, targetApkPath);
    const sizeMb = (fs.statSync(targetApkPath).size / (1024 * 1024)).toFixed(2);
    const sha256 = calculateSha256(targetApkPath);

    console.log('\n✔ Signed release APK created successfully!');
    console.log(`- File: ${targetApkPath}`);
    console.log(`- Size: ${sizeMb} MB`);
    console.log(`- SHA256: ${sha256}`);
  } else if (fs.existsSync(unsignedApk)) {
    fs.copyFileSync(unsignedApk, targetApkPath);
    const sizeMb = (fs.statSync(targetApkPath).size / (1024 * 1024)).toFixed(2);
    const sha256 = calculateSha256(targetApkPath);

    console.log('\n⚠ NOTICE: Release signing is not configured; manual keystore setup is required.');
    console.log(`- Unsigned APK copied to: ${targetApkPath}`);
    console.log(`- Size: ${sizeMb} MB`);
    console.log(`- SHA256: ${sha256}`);
    console.log('- For production distribution, sign this APK using apksigner or configure signingConfigs in android/app/build.gradle.');
  } else {
    console.error('\n✖ Error: No APK file found in ' + apkDir);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('Build Workflow Complete.');
  console.log('==================================================');
}

main();

