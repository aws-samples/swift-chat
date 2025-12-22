import { applyPatch } from 'diff';

// Placeholder for HTML code block - content is stored in message.htmlCode
export const HTML_CODE_PLACEHOLDER = '[HTML_OUTPUT_OMITTED]';

// Global storage for latest HTML code in App mode
let latestHtmlCode: string = '';

/**
 * Get the latest HTML code
 */
export function getLatestHtmlCode(): string {
  return latestHtmlCode;
}

/**
 * Set the latest HTML code
 */
export function setLatestHtmlCode(htmlCode: string): void {
  latestHtmlCode = htmlCode;
}

/**
 * Clear the latest HTML code (call when starting new session or leaving App mode)
 */
export function clearLatestHtmlCode(): void {
  latestHtmlCode = '';
}

/**
 * Replace HTML code in text with placeholder
 */
export function replaceHtmlWithPlaceholder(
  text: string,
  htmlCode: string
): string {
  return text.replace(htmlCode, HTML_CODE_PLACEHOLDER);
}

/**
 * Replace diff code block content with placeholder
 * Keeps the ```diff ``` structure but replaces content with placeholder
 */
export function replaceDiffWithPlaceholder(text: string): string {
  return text.replace(
    /```diff\n[\s\S]*?\n```/,
    '```diff\n' + HTML_CODE_PLACEHOLDER + '\n```'
  );
}

/**
 * Check if text contains the HTML placeholder
 */
export function isHtmlPlaceholder(text: string): boolean {
  return text.trim() === HTML_CODE_PLACEHOLDER;
}

/**
 * Extract diff code block from text
 */
export function extractDiffBlock(text: string): string | null {
  const match = text.match(/```diff\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

/**
 * Extract html code block from text
 */
export function extractHtmlBlock(text: string): string | null {
  const match = text.match(/```html\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

/**
 * Check if diff code block is complete
 */
export function isDiffBlockComplete(text: string): boolean {
  return /```diff\n[\s\S]*?\n```/.test(text);
}

/**
 * Check if text contains html code block start
 */
export function hasHtmlBlockStart(text: string): boolean {
  return /```html\n/.test(text);
}

/**
 * Check if HTML content is complete (ends with </html>)
 */
export function isHtmlComplete(html: string): boolean {
  return html.trimEnd().toLowerCase().endsWith('</html>');
}

/**
 * Apply diff patch to original HTML using jsdiff
 */
/**
 * Fix hunk headers in diff content to match actual line counts
 * AI-generated diffs often have incorrect line counts in hunk headers
 */
function fixHunkHeaders(diffContent: string): string {
  const lines = diffContent.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

    if (hunkMatch) {
      // Found a hunk header, count actual lines until next hunk or end
      const oldStart = hunkMatch[1];
      const newStart = hunkMatch[2];
      let oldCount = 0;
      let newCount = 0;
      let j = i + 1;

      // Count lines in this hunk
      while (j < lines.length && !lines[j].startsWith('@@')) {
        const hunkLine = lines[j];
        if (hunkLine.startsWith('-')) {
          oldCount++;
        } else if (hunkLine.startsWith('+')) {
          newCount++;
        } else if (hunkLine.startsWith(' ') || hunkLine === '') {
          // Context line or empty line (treat empty as context)
          oldCount++;
          newCount++;
        }
        j++;
      }

      // Write corrected hunk header
      result.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
      i++;
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

export function applyDiff(
  originalHtml: string,
  diffContent: string
): { success: boolean; result: string; error?: string } {
  try {
    // Fix hunk headers that may have incorrect line counts
    let normalizedDiff = fixHunkHeaders(diffContent);

    // Add unified diff header if missing (jsdiff requires it)
    if (!normalizedDiff.startsWith('---')) {
      normalizedDiff = `--- a/file\n+++ b/file\n${normalizedDiff}`;
    }

    const patched = applyPatch(originalHtml, normalizedDiff, {
      fuzzFactor: 2,
    });

    if (patched === false) {
      return {
        success: false,
        result: originalHtml,
        error: 'Patch could not be applied',
      };
    }

    return { success: true, result: patched };
  } catch (error) {
    return {
      success: false,
      result: originalHtml,
      error: String(error),
    };
  }
}

/**
 * Process AI response and extract/apply HTML code
 * Returns the final HTML code if successful
 */
export function processAppResponse(
  response: string,
  existingHtmlCode?: string
): { htmlCode: string | null; isDiff: boolean; error?: string } {
  // Check if response contains diff block
  if (existingHtmlCode && isDiffBlockComplete(response)) {
    const diffContent = extractDiffBlock(response);
    if (diffContent) {
      const { success, result, error } = applyDiff(
        existingHtmlCode,
        diffContent
      );
      if (success) {
        return { htmlCode: result, isDiff: true };
      }
      return { htmlCode: null, isDiff: true, error };
    }
  }

  // Check if response contains complete html block
  const htmlBlock = extractHtmlBlock(response);
  if (htmlBlock && isHtmlComplete(htmlBlock)) {
    return { htmlCode: htmlBlock, isDiff: false };
  }

  return { htmlCode: null, isDiff: false };
}
