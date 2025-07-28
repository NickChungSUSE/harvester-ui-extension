#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'SUSE';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'harvester-ui-extension';

if (!GITHUB_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// GitHub API helper
function githubRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${ REPO_OWNER }/${ REPO_NAME }${ endpoint }`,
      headers:  {
        Authorization: `token ${ GITHUB_TOKEN }`,
        'User-Agent':    'harvester-ui-extension-release-script'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${ data }`));
        }
      });
    }).on('error', reject);
  });
}

// Get PR author from GitHub API
async function getPRAuthor(prNumber) {
  try {
    const pr = await githubRequest(`/pulls/${ prNumber }`);

    return pr.user?.login || 'unknown';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to fetch PR ${ prNumber }: ${ error.message }`);

    return 'unknown';
  }
}

// Replace mergify[bot] with original author
async function replaceAuthor(changelogContent, prNumber, originalAuthor) {
  const mergifyPattern = new RegExp(`\\(#${ prNumber }\\)[^\\n]*mergify\\[bot\\]`, 'g');

  return changelogContent.replace(mergifyPattern, `(#${ prNumber }) - Author: ${ originalAuthor }`);
}

// Main function
async function fixAuthors() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    // eslint-disable-next-line no-console
    console.log('CHANGELOG.md not found, skipping author fix');

    return;
  }

  let changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // Find all PR numbers in the changelog
  const prNumbers = new Set();
  const prRegex = /\(#(\d+)\)/g;
  let match;

  while ((match = prRegex.exec(changelogContent)) !== null) {
    prNumbers.add(parseInt(match[1]));
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${ prNumbers.size } PR numbers to process`);

  // Process each PR number
  for (const prNumber of prNumbers) {
    // eslint-disable-next-line no-console
    console.log(`Processing PR #${ prNumber }...`);
    const originalAuthor = await getPRAuthor(prNumber);

    changelogContent = await replaceAuthor(changelogContent, prNumber, originalAuthor);
  }

  // Write the updated changelog
  fs.writeFileSync(changelogPath, changelogContent);
  // eslint-disable-next-line no-console
  console.log('Changelog authors updated successfully');
}

// Run the script
fixAuthors().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error fixing authors:', error);
  process.exit(1);
});
