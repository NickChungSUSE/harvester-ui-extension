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

// Get PR authors from GitHub API
async function getPRAuthors(prNumber) {
  try {
    const pr = await githubRequest(`/pulls/${ prNumber }`);

    if (!pr.user) {
      // eslint-disable-next-line no-console
      console.warn(`PR #${ prNumber } not found in this repository`);

      return 'PR not found';
    }

    // Get all commits in the PR to find all contributors
    const commits = await githubRequest(`/pulls/${ prNumber }/commits`);

    if (!Array.isArray(commits)) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to fetch commits for PR #${ prNumber }`);

      return pr.user.login; // Fallback to PR creator
    }

    // Collect all unique authors from commits
    const authors = new Set();

    authors.add(pr.user.login); // Add PR creator

    for (const commit of commits) {
      if (commit.author && commit.author.login) {
        authors.add(commit.author.login);
      }
      if (commit.committer && commit.committer.login) {
        authors.add(commit.committer.login);
      }
    }

    // Convert to array and sort
    const authorList = Array.from(authors).sort();

    // eslint-disable-next-line no-console
    console.log(`Found ${ authorList.length } authors for PR #${ prNumber }: ${ authorList.join(', ') }`);

    return authorList.join(', ');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to fetch PR ${ prNumber }: ${ error.message }`);

    return 'API error';
  }
}

// Extract PR numbers from changelog entries
function extractPRNumbers(changelogContent) {
  const prNumbers = new Set();

  // Match patterns like [#123] or (#123) in the changelog, but only the main PR references
  // Handle different formats:
  // - (#PR_NUMBER) (COMMIT_HASH) - old format
  // - (#PR_NUMBER) (COMMIT_HASH), closes - old format
  // - (#PR_NUMBER) (COMMIT_HASH), closes #OTHER_PR - old format
  // - ([#PR_NUMBER](link)) (COMMIT_HASH), closes - new format
  // We want to match the main PR reference, not the "closes #PR" part
  // Look for the first PR number that's not in the "closes" part
  const prRegex = /#(\d+)/g;
  let match;

  while ((match = prRegex.exec(changelogContent)) !== null) {
    // Add all PR numbers found in the changelog
    const prNumber = parseInt(match[1]);

    prNumbers.add(prNumber);
  }

  return prNumbers;
}

// Add original authors to changelog entries
async function addOriginalAuthors(changelogContent) {
  const prNumbers = extractPRNumbers(changelogContent);

  // eslint-disable-next-line no-console
  console.log(`Found ${ prNumbers.size } PR numbers to process`);

  let updatedContent = changelogContent;

  // Process each PR number
  for (const prNumber of prNumbers) {
    // eslint-disable-next-line no-console
    console.log(`Processing PR #${ prNumber }...`);
    const originalAuthors = await getPRAuthors(prNumber);

    // Try new format first
    let pattern = new RegExp(`\\(\\[#${ prNumber }\\]\\([^)]+\\)\\)`, 'g');

    // If API failed, don't change the line at all
    if (originalAuthors.includes('not found') || originalAuthors.includes('API error')) {
      // eslint-disable-next-line no-console
      console.log(`Skipping PR #${ prNumber } due to API error, preserving existing content`);
      continue;
    }

    // Add @ to each individual author
    const authorsWithAt = originalAuthors.split(', ').map((author) => `@${ author.trim() }`).join(', ');

    if (updatedContent.match(pattern)) {
      updatedContent = updatedContent.replace(pattern, `([#${ prNumber }](https://github.com/NickChungSUSE/harvester-ui-extension/pull/${ prNumber })) - Authors: ${ authorsWithAt }`);
    } else {
      // Try old format - replace the entire line content after the PR number
      pattern = new RegExp(`\\(#${ prNumber }\\)[^\\n]*`, 'g');
      updatedContent = updatedContent.replace(pattern, `([#${ prNumber }](https://github.com/NickChungSUSE/harvester-ui-extension/pull/${ prNumber })) - Authors: ${ authorsWithAt }`);
    }
  }

  return updatedContent;
}

// Restore commit type prefixes to changelog entries
function restoreCommitPrefixes(changelogContent) {
  // Map of section titles to their commit type prefixes
  const sectionPrefixMap = {
    Features:                   'feat',
    'Bug Fixes':                'fix',
    'Performance Improvements': 'perf',
    Documentation:              'docs',
    'Code Style Changes':       'style',
    Refactoring:                'refactor',
    Tests:                      'test',
    'Build System':             'build',
    'CI/CD':                    'ci',
    Dependencies:               'deps',
    Security:                   'security',
    Chores:                     'chore'
  };

  const lines = changelogContent.split('\n');
  let currentPrefix = null;

  const processedLines = lines.map((line) => {
    const trimmedLine = line.trim();

    // Check if this line is a section header
    if (sectionPrefixMap[trimmedLine]) {
      currentPrefix = sectionPrefixMap[trimmedLine];

      return line; // Return the section header as-is
    }

    // If we're in a section and this line is not empty and not a section header
    if (currentPrefix && trimmedLine && !sectionPrefixMap[trimmedLine]) {
      // Check if prefix is already present
      if (trimmedLine.startsWith(`${ currentPrefix }: `)) {
        return line; // Already has prefix, don't add again
      }
      // If line starts with *, keep the bullet point
      if (trimmedLine.startsWith('* ')) {
        return `* ${ currentPrefix }: ${ trimmedLine.substring(2) }`;
      }

      // Otherwise, add the prefix directly
      return `${ currentPrefix }: ${ trimmedLine }`;
    }

    return line;
  });

  return processedLines.join('\n');
}

// Main function
async function addAuthors() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

  // eslint-disable-next-line no-console
  console.log('Script started');
  // eslint-disable-next-line no-console
  console.log('Current working directory:', process.cwd());
  // eslint-disable-next-line no-console
  console.log('Changelog path:', changelogPath);

  if (!fs.existsSync(changelogPath)) {
    // eslint-disable-next-line no-console
    console.log('CHANGELOG.md not found, skipping author addition');

    return;
  }

  // eslint-disable-next-line no-console
  console.log('CHANGELOG.md found, reading content...');
  let changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // eslint-disable-next-line no-console
  console.log('Changelog content length:', changelogContent.length);
  // eslint-disable-next-line no-console
  console.log('First 200 characters:', changelogContent.substring(0, 200));

  // Add original authors to the changelog
  // eslint-disable-next-line no-console
  console.log('Adding original authors...');
  changelogContent = await addOriginalAuthors(changelogContent);

  // Restore commit type prefixes
  // eslint-disable-next-line no-console
  console.log('Restoring commit prefixes...');
  changelogContent = restoreCommitPrefixes(changelogContent);

  // Write the updated changelog
  // eslint-disable-next-line no-console
  console.log('Writing updated changelog...');
  fs.writeFileSync(changelogPath, changelogContent);
  // eslint-disable-next-line no-console
  console.log('Original authors added and prefixes restored to changelog successfully');
}

// Run the script
addAuthors().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error adding original authors:', error);
  process.exit(1);
});
