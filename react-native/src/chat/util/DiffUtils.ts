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
 * Represents a single change block within a hunk
 * A hunk can have multiple change blocks separated by context lines
 */
interface ChangeBlock {
  contextBefore: string[]; // Context lines before this change (for searching)
  removals: string[]; // Lines to remove
  additions: string[]; // Lines to add
}

/**
 * Parse diff content into change blocks
 * Handles AI-generated diffs with:
 * 1. Incorrect line numbers in hunk headers
 * 2. Empty lines without leading space
 * 3. Multiple change blocks within a single hunk
 */
function parseChangeBlocks(diffContent: string): ChangeBlock[] {
  const lines = diffContent.split('\n');
  const blocks: ChangeBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip non-hunk lines (file headers, etc.)
    if (!line.startsWith('@@')) {
      i++;
      continue;
    }

    // Found a hunk header, parse the hunk
    i++; // Skip the @@ line

    let currentContext: string[] = [];
    let currentRemovals: string[] = [];
    let currentAdditions: string[] = [];
    let inChange = false;

    while (i < lines.length && !lines[i].startsWith('@@')) {
      let hunkLine = lines[i];

      // Fix empty lines: they should be context lines
      if (hunkLine === '') {
        hunkLine = ' ';
      }

      if (hunkLine.startsWith('-')) {
        inChange = true;
        currentRemovals.push(hunkLine.substring(1));
      } else if (hunkLine.startsWith('+')) {
        inChange = true;
        currentAdditions.push(hunkLine.substring(1));
      } else {
        // Context line: either starts with ' ' or has no prefix (AI-generated diff)
        const content = hunkLine.startsWith(' ')
          ? hunkLine.substring(1)
          : hunkLine;

        if (inChange) {
          // We hit a context line after changes - save the current block
          if (currentRemovals.length > 0 || currentAdditions.length > 0) {
            blocks.push({
              contextBefore: currentContext,
              removals: currentRemovals,
              additions: currentAdditions,
            });
          }
          // Start new context, carrying over this line
          currentContext = [content];
          currentRemovals = [];
          currentAdditions = [];
          inChange = false;
        } else {
          // Still in context before changes
          currentContext.push(content);
        }
      }

      i++;
    }

    // Don't forget the last change block in the hunk
    if (currentRemovals.length > 0 || currentAdditions.length > 0) {
      blocks.push({
        contextBefore: currentContext,
        removals: currentRemovals,
        additions: currentAdditions,
      });
    }
  }

  return blocks;
}

/**
 * Compare two lines with fuzzy whitespace matching
 * AI-generated diffs often have incorrect indentation
 */
function linesMatch(sourceLine: string, patternLine: string): boolean {
  // Exact match
  if (sourceLine === patternLine) {
    return true;
  }

  // Fuzzy match: compare trimmed content (ignore leading/trailing whitespace differences)
  return sourceLine.trim() === patternLine.trim();
}

/**
 * Get the leading whitespace from a line
 */
function getIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Apply the indentation from a source line to a new line
 */
function applyIndent(newLine: string, sourceLine: string): string {
  const sourceIndent = getIndent(sourceLine);
  const newContent = newLine.trim();

  // If the new line is empty, keep it empty
  if (newContent === '') {
    return '';
  }

  return sourceIndent + newContent;
}

/**
 * Find the position in source lines where the change block context matches
 * Returns the line index where removals should start, or -1 if not found
 *
 * @param searchFromStart - if true, always search from the beginning of the file
 */
function findBlockPosition(
  sourceLines: string[],
  block: ChangeBlock,
  startFrom: number,
  searchFromStart: boolean = false
): number {
  const { contextBefore, removals } = block;

  // Build the pattern to search for: context + removals
  const searchPattern = [...contextBefore, ...removals];

  if (searchPattern.length === 0) {
    return startFrom; // No context, apply at current position
  }

  // If searchFromStart is true, always start from beginning
  // Otherwise, allow searching a bit before startFrom to handle overlapping contexts
  const searchStart = searchFromStart
    ? 0
    : Math.max(0, startFrom - contextBefore.length);

  // Search for the pattern in source
  for (
    let i = searchStart;
    i <= sourceLines.length - searchPattern.length;
    i++
  ) {
    let matches = true;

    for (let j = 0; j < searchPattern.length; j++) {
      if (!linesMatch(sourceLines[i + j], searchPattern[j])) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Return the position where removals start (after contextBefore)
      return i + contextBefore.length;
    }
  }

  return -1; // Not found
}

/**
 * Represents a change block with its position in the source file
 */
interface PositionedBlock {
  block: ChangeBlock;
  position: number; // Position where removals start in source
  originalIndex: number; // Original index in parsed blocks array
}

/**
 * Apply diff to original HTML using context-based matching
 * This handles AI-generated diffs with:
 * 1. Incorrect line numbers in hunk headers
 * 2. Hunks in wrong order (not sorted by position in source file)
 * 3. Empty lines without leading space
 */
export function applyDiff(
  originalHtml: string,
  diffContent: string
): { success: boolean; result: string; error?: string } {
  try {
    const blocks = parseChangeBlocks(diffContent);

    if (blocks.length === 0) {
      return {
        success: false,
        result: originalHtml,
        error: 'No valid change blocks found in diff',
      };
    }

    const sourceLines = originalHtml.split('\n');

    // First pass: find positions for all blocks (searching from start each time)
    // This handles AI-generated diffs where hunks may be in wrong order
    const positionedBlocks: PositionedBlock[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      // Search from start to find the actual position in source
      const position = findBlockPosition(sourceLines, block, 0, true);

      if (position === -1) {
        return {
          success: false,
          result: originalHtml,
          error: `Could not find matching context for change block ${i + 1}`,
        };
      }

      positionedBlocks.push({
        block,
        position,
        originalIndex: i,
      });
    }

    // Sort blocks by their position in the source file
    positionedBlocks.sort((a, b) => a.position - b.position);

    // Check for overlapping blocks
    for (let i = 1; i < positionedBlocks.length; i++) {
      const prev = positionedBlocks[i - 1];
      const curr = positionedBlocks[i];
      const prevEnd = prev.position + prev.block.removals.length;

      if (curr.position < prevEnd) {
        return {
          success: false,
          result: originalHtml,
          error: `Overlapping change blocks detected: block ${prev.originalIndex + 1} and block ${curr.originalIndex + 1}`,
        };
      }
    }

    // Apply blocks in sorted order
    const resultLines: string[] = [];
    let sourceIdx = 0;

    for (const { block } of positionedBlocks) {
      // Find position again (should match, but ensures consistency)
      const blockPos = findBlockPosition(sourceLines, block, sourceIdx);

      if (blockPos === -1 || blockPos < sourceIdx) {
        // This shouldn't happen after sorting, but handle gracefully
        return {
          success: false,
          result: originalHtml,
          error: 'Internal error: block position mismatch after sorting',
        };
      }

      // Copy lines before the block
      while (sourceIdx < blockPos) {
        resultLines.push(sourceLines[sourceIdx]);
        sourceIdx++;
      }

      // Determine the correct indentation from the source
      // Use the first removal line's indentation, or the last context line if no removals
      let referenceIndentLine = '';
      if (block.removals.length > 0 && sourceIdx < sourceLines.length) {
        referenceIndentLine = sourceLines[sourceIdx];
      } else if (block.contextBefore.length > 0 && sourceIdx > 0) {
        referenceIndentLine = sourceLines[sourceIdx - 1];
      }

      // Add the new lines (additions) with corrected indentation
      for (const addition of block.additions) {
        if (referenceIndentLine && addition.trim() !== '') {
          resultLines.push(applyIndent(addition, referenceIndentLine));
        } else {
          resultLines.push(addition);
        }
      }

      // Skip the removed lines in source
      // For pure additions (removals.length === 0), this won't advance sourceIdx
      sourceIdx += block.removals.length;
    }

    // Copy remaining lines
    while (sourceIdx < sourceLines.length) {
      resultLines.push(sourceLines[sourceIdx]);
      sourceIdx++;
    }

    return { success: true, result: resultLines.join('\n') };
  } catch (error) {
    return {
      success: false,
      result: originalHtml,
      error: String(error),
    };
  }
}