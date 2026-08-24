#!/usr/bin/env node
/**
 * TSA Outliers Monitoring - Interactive Deployment Setup
 * 
 * Run: node scripts/deploy/setup.js
 * 
 * This script will guide you through:
 *   1. Creating a GitHub repo and pushing code
 *   2. Setting up a Supabase database
 *   3. Deploying to Vercel
 */

const { execSync } = require('child_process');
const readline = require('readline');
const https = require('https');
const http = require('http');

const GITHUB_USERNAME = 'zacrie85';
const REPO_NAME = 'tsa-outliers-monitoring';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', ...options });
  } catch (e) {
    return null;
  }
}

function log(msg, color = '') {
  const colors = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', reset: '\x1b[0m' };
  console.log(`${colors[color] || ''}${msg}${colors.reset}`);
}

async function githubDeploy(token) {
  log('\n--- GitHub Deployment ---', 'blue');
  
  // Create repo
  log('Creating repository...', 'yellow');
  const result = run(`curl -s -X POST -H "Authorization: token ${token}" -H "Accept: application/vnd.github.v3+json" https://api.github.com/user/repos -d '{"name":"${REPO_NAME}","description":"TSA Outliers Monitoring System","private":false}'`);
  
  try {
    const data = JSON.parse(result);
    if (data.html_url) {
      log(`Repository created: ${data.html_url}`, 'green');
    } else if (data.message && data.message.includes('already exists')) {
      log('Repository already exists, pushing to it...', 'yellow');
    } else {
      log(`Unexpected response: ${data.message}`, 'red');
    }
  } catch {
    log('Could not parse GitHub response', 'red');
    return false;
  }
  
  // Push code
  const branch = run('git branch --show-current')?.trim() || 'main';
  run(`git remote remove origin 2>/dev/null; git remote add origin https://${token}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git`);
  
  const pushResult = run(`git push -u origin ${branch} --force 2>&1`);
  if (pushResult && pushResult.includes('done')) {
    log(`Code pushed successfully!`, 'green');
    log(`https://github.com/${GITHUB_USERNAME}/${REPO_NAME}`, 'green');
  } else {
    log('Push may have failed. Try manually:', 'red');
    log(`  git push -u origin ${branch}`, 'yellow');
  }
  
  return true;
}

async function supabaseSetup(token) {
  log('\n--- Supabase Setup ---', 'blue');
  
  log('Logging in to Supabase...', 'yellow');
  run(`npx supabase login --token ${token}`);
  
  log('Creating Supabase project...', 'yellow');
  log('Note: If project already exists, this will be skipped.', 'yellow');
  
  const result = run(`npx supabase projects create --name tsa-outliers-monitoring --database-password asrama33 --region ase-southeast -o json 2>&1`, { timeout: 120000 });
  
  if (result) {
    try {
      const data = JSON.parse(result);
      if (data.id) {
        const dbHost = data.database?.host || `db.${data.id}.supabase.co`;
        const dbUrl = `postgresql://postgres.asrama33:${data.id}@${dbHost}:5432/postgres`;
        log(`Project created!`, 'green');
        log(`DATABASE_URL: ${dbUrl}`, 'green');
        
        // Save for Vercel step
        require('fs').writeFileSync('.supabase-db-url', dbUrl);
        
        // Push schema
        log('\nPushing database schema...', 'yellow');
        run(`DATABASE_URL="${dbUrl}" npx prisma db push --accept-data-loss 2>&1`, { timeout: 60000 });
        log('Schema pushed!', 'green');
        
        return dbUrl;
      }
    } catch {}
  }
  
  log('Could not create project automatically.', 'red');
  log('Please create manually at: https://supabase.com/dashboard/new-project', 'yellow');
  
  const manualUrl = await question('Enter your Supabase DATABASE_URL (or press Enter to skip): ');
  if (manualUrl) {
    require('fs').writeFileSync('.supabase-db-url', manualUrl);
    log('\nPushing database schema...', 'yellow');
    run(`DATABASE_URL="${manualUrl}" npx prisma db push --accept-data-loss 2>&1`, { timeout: 60000 });
    log('Schema pushed!', 'green');
    return manualUrl;
  }
  
  return null;
}

async function vercelDeploy(token, dbUrl) {
  log('\n--- Vercel Deployment ---', 'blue');
  
  let cmd = `npx vercel deploy --yes --prod --token ${token}`;
  if (dbUrl) {
    cmd += ` --env DATABASE_URL=${dbUrl}`;
  }
  
  log('Deploying to Vercel...', 'yellow');
  const result = run(cmd, { timeout: 180000 });
  
  if (result) {
    const urlMatch = result.match(/https:\/\/[a-z0-9-]+\.vercel\.app/);
    if (urlMatch) {
      log(`Deployed successfully!`, 'green');
      log(`URL: ${urlMatch[0]}`, 'green');
      return urlMatch[0];
    }
  }
  
  log('Deployment may have failed. Check Vercel dashboard.', 'red');
  return null;
}

async function main() {
  console.log('');
  log('============================================', 'blue');
  log(' TSA Outliers Monitoring - Deploy Setup', 'blue');
  log('============================================', 'blue');
  console.log('');
  
  log('This script will deploy your app to GitHub, Supabase, and Vercel.', '');
  log('You need 3 tokens (get them ready):', '');
  log('  1. GitHub PAT:    https://github.com/settings/tokens', 'yellow');
  log('     (Select: repo, workflow scopes)', 'yellow');
  log('  2. Supabase:      https://supabase.com/dashboard/account/tokens', 'yellow');
  log('  3. Vercel:        https://vercel.com/account/tokens', 'yellow');
  console.log('');
  
  // Step 1: GitHub
  const ghToken = await question('\n[1/3] Enter GitHub Personal Access Token: ');
  if (ghToken.trim()) {
    await githubDeploy(ghToken.trim());
  } else {
    log('Skipped GitHub deployment.', 'yellow');
  }
  
  // Step 2: Supabase
  const sbToken = await question('\n[2/3] Enter Supabase Access Token: ');
  let dbUrl = null;
  if (sbToken.trim()) {
    dbUrl = await supabaseSetup(sbToken.trim());
  } else {
    const manualUrl = await question('Skip Supabase? Enter DATABASE_URL manually (or Enter to skip): ');
    if (manualUrl.trim()) dbUrl = manualUrl.trim();
    else log('Skipped Supabase setup.', 'yellow');
  }
  
  // Step 3: Vercel
  const vcToken = await question('\n[3/3] Enter Vercel Token: ');
  if (vcToken.trim()) {
    await vercelDeploy(vcToken.trim(), dbUrl);
  } else {
    log('Skipped Vercel deployment.', 'yellow');
  }
  
  console.log('');
  log('============================================', 'green');
  log(' Setup Complete!', 'green');
  log('============================================', 'green');
  console.log('');
  
  if (dbUrl) {
    log('IMPORTANT: Set this environment variable on Vercel:', 'yellow');
    log(`  DATABASE_URL=${dbUrl}`, 'yellow');
    console.log('');
    log('Or via CLI:', '');
    log(`  vercel env add DATABASE_URL production`, '');
    console.log('');
  }
  
  log('To seed data after Supabase is set up:', 'yellow');
  log('  DATABASE_URL="your_url" npx tsx scripts/seed-supabase.ts', '');
  console.log('');
  
  rl.close();
}

main().catch(console.error);
