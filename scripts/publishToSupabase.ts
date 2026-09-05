/**
 * scripts/publishToSupabase.ts
 *
 * Dedicated Supabase Storage upload & public.app_releases upsert runner for TASKER.
 * Uses process.env.SUPABASE_SERVICE_ROLE_KEY for privileged operations without hardcoding secrets.
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-key"; node --experimental-strip-types scripts/publishToSupabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const rootDir = process.cwd();
  const envPath = path.join(rootDir, '.env');
  const envMap: Record<string, string> = {};

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        envMap[match[1]] = match[2] ? match[2].trim().replace(/^['"](.*)['"]$/, '$1') : '';
      }
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || envMap['VITE_SUPABASE_URL'] || 'https://xargfforwknnicudigxs.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envMap['SUPABASE_SERVICE_ROLE_KEY'] || null;

  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = pkg.version || '1.0.4';
  let versionCode = 5;
  const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradlePath)) {
    const gradleContent = fs.readFileSync(gradlePath, 'utf8');
    const match = gradleContent.match(/versionCode\s+(\d+)/);
    if (match) versionCode = parseInt(match[1], 10);
  }
  const apkName = `TASKER-v${version}.apk`;
  const apkPath = path.join(rootDir, apkName);

  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK file not found: ${apkPath}`);
  }

  const releaseNotes = `TASKER v${version} Production Release:
- High-precision 1-minute reminders and quick schedule presets
- Localized and timezone-accurate datetime formatting
- Streamlined App Updates & Version settings center
- Rock-solid background alarm scheduling and pending task synchronization
- Configurable periodic pending tasks reminder (1h, 2h, 4h, 8h, daily) with auto-suppress at 0 tasks
- Notification tap deep-linking to task detail and pending tasks list
- Clean in-app App Updates & Version management`;

  const githubReleaseUrl = `https://github.com/khandagalesuraj48-sys/TASKER/releases/tag/v${version}`;

  if (!serviceRoleKey) {
    console.log('------------------------------------------------------------');
    console.log('NOTICE: SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
    console.log('------------------------------------------------------------');
    console.log('To automate upload and database registration in one command:');
    console.log('$env:SUPABASE_SERVICE_ROLE_KEY="your-secret-key"');
    console.log('node --experimental-strip-types scripts/publishToSupabase.ts');
    console.log('');
    console.log('Or apply the update directly in Supabase Dashboard SQL Editor:');
    console.log(`
INSERT INTO public.app_releases (
    version_name,
    version_code,
    release_notes,
    apk_url,
    release_url,
    is_mandatory
) VALUES (
    '${version}',
    ${versionCode},
    '${releaseNotes.replace(/'/g, "''")}',
    'https://xargfforwknnicudigxs.supabase.co/storage/v1/object/public/app-releases/app-release.apk',
    '${githubReleaseUrl}',
    false
) ON CONFLICT (version_code) DO UPDATE SET
    version_name = EXCLUDED.version_name,
    release_notes = EXCLUDED.release_notes,
    apk_url = EXCLUDED.apk_url,
    release_url = EXCLUDED.release_url,
    is_mandatory = EXCLUDED.is_mandatory;
`);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const apkBuffer = fs.readFileSync(apkPath);
  const apkStats = fs.statSync(apkPath);
  console.log(`Uploading ${apkName} (${(apkStats.size / (1024 * 1024)).toFixed(2)} MB) to Supabase Storage bucket 'app-releases'...`);

  // 1. Upload versioned APK
  const { error: uploadErr1 } = await supabase.storage
    .from('app-releases')
    .upload(apkName, apkBuffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadErr1) {
    throw new Error(`Failed to upload ${apkName}: ${uploadErr1.message}`);
  }

  // 2. Also update 'app-release.apk' alias
  const { error: uploadErr2 } = await supabase.storage
    .from('app-releases')
    .upload('app-release.apk', apkBuffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '60'
    });

  if (uploadErr2) {
    console.warn(`Warning updating app-release.apk alias: ${uploadErr2.message}`);
  }

  const { data: urlData } = supabase.storage.from('app-releases').getPublicUrl(apkName);
  const publicApkUrl = urlData.publicUrl;
  console.log(`✔ APK uploaded successfully. Public URL: ${publicApkUrl}`);

  // 3. Verify public URL returns HTTP 200
  console.log(`Verifying public HTTP access to uploaded APK...`);
  const verifyRes = await fetch(publicApkUrl, { method: 'HEAD' });
  if (!verifyRes.ok) {
    throw new Error(`Uploaded APK returned HTTP ${verifyRes.status}: ${publicApkUrl}`);
  }
  console.log(`✔ Public URL verified (HTTP ${verifyRes.status}, Content-Length: ${verifyRes.headers.get('content-length')})`);

  // 4. Upsert into public.app_releases
  console.log(`Registering release in Supabase public.app_releases...`);
  const { data: upsertData, error: upsertErr } = await supabase
    .from('app_releases')
    .upsert({
      version_name: version,
      version_code: versionCode,
      release_notes: releaseNotes,
      apk_url: publicApkUrl,
      release_url: githubReleaseUrl,
      is_mandatory: false
    }, { onConflict: 'version_code' })
    .select();

  if (upsertErr) {
    throw new Error(`Failed to register in public.app_releases: ${upsertErr.message}`);
  }

  console.log(`✔ Registered in public.app_releases:`, upsertData);
}

main().catch(err => {
  console.error('✖ Error:', err);
  process.exit(1);
});

