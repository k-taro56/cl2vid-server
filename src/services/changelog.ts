/**
 * Fetches and parses GitHub Changelog content
 */
export async function fetchChangelog(url: string): Promise<string> {
  // Convert GitHub blob URLs to raw content URLs
  const rawUrl = url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');

  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch changelog: ${response.statusText}`);
  }

  const content = await response.text();
  return content;
}

/**
 * Extracts the latest release section from changelog
 */
export function extractLatestRelease(changelog: string): string {
  // Try to find version headers (e.g., ## [1.0.0], # v1.0.0, etc.)
  const lines = changelog.split('\n');
  const releaseLines: string[] = [];
  let foundFirstRelease = false;
  let foundSecondRelease = false;

  for (const line of lines) {
    // Match common version header patterns
    const isVersionHeader = /^#{1,3}\s*\[?\d+\.\d+\.?/.test(line) || /^#{1,3}\s*v\d+\.\d+\.?/.test(line);

    if (isVersionHeader) {
      if (!foundFirstRelease) {
        foundFirstRelease = true;
        releaseLines.push(line);
      } else {
        foundSecondRelease = true;
        break;
      }
    } else if (foundFirstRelease && !foundSecondRelease) {
      releaseLines.push(line);
    }
  }

  if (releaseLines.length === 0) {
    // If no version headers found, return first 50 lines
    return lines.slice(0, 50).join('\n');
  }

  return releaseLines.join('\n').trim();
}
