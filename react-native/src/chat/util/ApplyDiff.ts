/**
 * ApplyDiff - A robust diff application utility
 *
 * Diff Format (no line numbers, content-based matching):
 * @@@@
 * [context lines - no prefix, for locating position]
 * -[lines to remove]
 * +[lines to add]
 * [context lines - no prefix]
 *
 * Features:
 * - No line numbers dependency (AI often gets them wrong)
 * - Three-layer fallback matching strategy
 * - Handles out-of-order blocks by sorting
 * - Whitespace tolerance for AI-generated diffs
 */

/**
 * Represents a single diff block
 */
interface DiffBlock {
  contextBefore: string[]; // Context lines before changes (for locating)
  removals: string[]; // Lines to remove (- prefix)
  additions: string[]; // Lines to add (+ prefix)
  contextAfter: string[]; // Context lines after changes
}

/**
 * Positioned block with its location in source file
 */
interface PositionedBlock {
  block: DiffBlock;
  position: number; // Line index where removals start
  originalIndex: number; // Original index in parsed blocks
}

/**
 * Result of applying diff
 */
export interface ApplyDiffResult {
  success: boolean;
  result: string;
  error?: string;
}

const BLOCK_SEPARATOR = '@@@@';

/**
 * Parse diff content into blocks
 * When a context line appears after changes, it starts a new block.
 * This simplifies handling of wrap replacements like <a>...</a> -> <div>...</div>
 */
function parseDiffBlocks(diffContent: string): DiffBlock[] {
  const lines = diffContent.split('\n');
  const blocks: DiffBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    // Find block start
    if (lines[i].trim() === BLOCK_SEPARATOR) {
      i++;

      let currentContext: string[] = [];
      let currentRemovals: string[] = [];
      let currentAdditions: string[] = [];
      let inChange = false;

      while (i < lines.length && lines[i].trim() !== BLOCK_SEPARATOR) {
        const line = lines[i];

        if (line.startsWith('-')) {
          inChange = true;
          currentRemovals.push(line.substring(1));
        } else if (line.startsWith('+')) {
          inChange = true;
          currentAdditions.push(line.substring(1));
        } else {
          // Context line
          const content = line.startsWith(' ') ? line.substring(1) : line;

          if (inChange) {
            // Hit a context line after changes - save current block and start new one
            if (currentRemovals.length > 0 || currentAdditions.length > 0) {
              blocks.push({
                contextBefore: currentContext,
                removals: currentRemovals,
                additions: currentAdditions,
                contextAfter: [], // No contextAfter in this simplified model
              });
            }
            // Start new block with this context line
            currentContext = [content];
            currentRemovals = [];
            currentAdditions = [];
            inChange = false;
          } else {
            // Still collecting context before changes
            currentContext.push(content);
          }
        }

        i++;
      }

      // Don't forget the last block
      if (currentRemovals.length > 0 || currentAdditions.length > 0) {
        blocks.push({
          contextBefore: currentContext,
          removals: currentRemovals,
          additions: currentAdditions,
          contextAfter: [],
        });
      }
    } else {
      i++;
    }
  }

  return blocks;
}

/**
 * Compare two lines with exact match
 */
function exactLineMatch(sourceLine: string, patternLine: string): boolean {
  return sourceLine === patternLine;
}

/**
 * Compare two lines with trimmed match (whitespace tolerant)
 */
function trimmedLineMatch(sourceLine: string, patternLine: string): boolean {
  return sourceLine.trim() === patternLine.trim();
}

/**
 * Layer 1: Exact match - find pattern in source lines
 */
function exactMatch(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number {
  if (pattern.length === 0) {
    return -1;
  }

  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    let matches = true;
    for (let j = 0; j < pattern.length; j++) {
      if (!exactLineMatch(sourceLines[i + j], pattern[j])) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i;
    }
  }

  return -1;
}

/**
 * Layer 2: Trimmed match - ignore leading/trailing whitespace per line
 */
function trimmedMatch(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number {
  if (pattern.length === 0) {
    return -1;
  }

  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    let matches = true;
    for (let j = 0; j < pattern.length; j++) {
      if (!trimmedLineMatch(sourceLines[i + j], pattern[j])) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i;
    }
  }

  return -1;
}

/**
 * Layer 3: Anchor match - use first and last lines as anchors
 * Only for patterns with 3+ lines
 */
function anchorMatch(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number {
  if (pattern.length < 3) {
    return -1;
  }

  const firstLine = pattern[0];
  const lastLine = pattern[pattern.length - 1];

  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    if (
      trimmedLineMatch(sourceLines[i], firstLine) &&
      trimmedLineMatch(sourceLines[i + pattern.length - 1], lastLine)
    ) {
      return i;
    }
  }

  return -1;
}

/**
 * Find block position using three-layer fallback strategy
 * Returns the line index where removals should start
 */
function findBlockPosition(
  sourceLines: string[],
  block: DiffBlock,
  startFrom: number = 0
): number {
  const { contextBefore, removals } = block;

  // Build search pattern: context + removals
  const fullPattern = [...contextBefore, ...removals];

  if (fullPattern.length === 0) {
    // Pure addition with no context - cannot locate
    return -1;
  }

  // Layer 1: Exact match
  let pos = exactMatch(sourceLines, fullPattern, startFrom);
  if (pos !== -1) {
    return pos + contextBefore.length;
  }

  // Layer 2: Trimmed match (whitespace tolerant)
  pos = trimmedMatch(sourceLines, fullPattern, startFrom);
  if (pos !== -1) {
    return pos + contextBefore.length;
  }

  // Layer 3: Anchor match (first + last line)
  if (fullPattern.length >= 3) {
    pos = anchorMatch(sourceLines, fullPattern, startFrom);
    if (pos !== -1) {
      return pos + contextBefore.length;
    }
  }

  // Fallback: Try with reduced context (last 1-2 lines only)
  if (contextBefore.length > 0 && removals.length > 0) {
    for (const contextSize of [2, 1]) {
      if (contextSize > contextBefore.length) {
        continue;
      }

      const reducedContext = contextBefore.slice(-contextSize);
      const reducedPattern = [...reducedContext, ...removals];

      pos = trimmedMatch(sourceLines, reducedPattern, startFrom);
      if (pos !== -1) {
        return pos + reducedContext.length;
      }
    }
  }

  // Last resort: Try matching only removals (if unique enough)
  if (removals.length >= 2) {
    pos = trimmedMatch(sourceLines, removals, startFrom);
    if (pos !== -1) {
      return pos;
    }
  }

  // Extra fallback: Try context + first removal only
  // This handles cases where AI includes non-consecutive removals
  if (contextBefore.length > 0 && removals.length > 0) {
    const contextPlusFirst = [...contextBefore, removals[0]];
    pos = trimmedMatch(sourceLines, contextPlusFirst, startFrom);
    if (pos !== -1) {
      return pos + contextBefore.length;
    }

    // Try last 2 context + first removal
    if (contextBefore.length >= 2) {
      const reducedPattern = [...contextBefore.slice(-2), removals[0]];
      pos = trimmedMatch(sourceLines, reducedPattern, startFrom);
      if (pos !== -1) {
        return pos + 2;
      }
    }

    // Try last 1 context + first removal
    const minPattern = [contextBefore[contextBefore.length - 1], removals[0]];
    pos = trimmedMatch(sourceLines, minPattern, startFrom);
    if (pos !== -1) {
      return pos + 1;
    }
  }

  return -1;
}

/**
 * Get leading whitespace from a line
 */
function getIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Apply indentation from reference line to new line
 * Preserves relative indentation within multi-line additions
 */
function applyIndent(
  newLine: string,
  referenceLine: string,
  baseIndent: string = ''
): string {
  const trimmed = newLine.trim();
  if (trimmed === '') {
    return '';
  }

  const refIndent = getIndent(referenceLine);
  const newLineIndent = getIndent(newLine);

  // Calculate relative indent from the base (first addition line)
  if (baseIndent && newLineIndent.length > baseIndent.length) {
    // This line has more indent than base - preserve the extra
    const extraIndent = newLineIndent.substring(baseIndent.length);
    return refIndent + extraIndent + trimmed;
  }

  return refIndent + trimmed;
}

/**
 * Apply diff to original content
 *
 * @param originalContent - The original file content
 * @param diffContent - The diff content with @@@@ blocks
 * @returns ApplyDiffResult with success status and result/error
 */
export function applyDiff(
  originalContent: string,
  diffContent: string
): ApplyDiffResult {
  try {
    // 1. Parse diff blocks
    const blocks = parseDiffBlocks(diffContent);

    if (blocks.length === 0) {
      return {
        success: false,
        result: originalContent,
        error: 'No valid diff blocks found (blocks should be separated by @@@@)',
      };
    }

    const sourceLines = originalContent.split('\n');

    // 2. Find position for each block (search from beginning each time)
    const positionedBlocks: PositionedBlock[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const position = findBlockPosition(sourceLines, block, 0);

      if (position === -1) {
        const context = block.contextBefore.slice(0, 2).join('\n');
        const removal = block.removals.slice(0, 2).join('\n');
        return {
          success: false,
          result: originalContent,
          error: `Block ${i + 1}: Cannot find matching position.\nContext: ${context}\nRemovals: ${removal}`,
        };
      }

      positionedBlocks.push({
        block,
        position,
        originalIndex: i,
      });
    }

    // 3. Sort by position
    positionedBlocks.sort((a, b) => a.position - b.position);

    // 4. Check for overlapping blocks
    for (let i = 1; i < positionedBlocks.length; i++) {
      const prev = positionedBlocks[i - 1];
      const curr = positionedBlocks[i];
      const prevEnd = prev.position + prev.block.removals.length;

      if (curr.position < prevEnd) {
        return {
          success: false,
          result: originalContent,
          error: `Overlapping blocks: Block ${prev.originalIndex + 1} (ends at line ${prevEnd}) overlaps with Block ${curr.originalIndex + 1} (starts at line ${curr.position})`,
        };
      }
    }

    // 5. Apply changes in sorted order
    // With the new parser, each block is a simple replacement/addition
    // No need for complex wrap replacement logic
    const resultLines: string[] = [];
    let sourceIdx = 0;

    for (const { block, position } of positionedBlocks) {
      // Copy unchanged lines before this block
      while (sourceIdx < position) {
        resultLines.push(sourceLines[sourceIdx]);
        sourceIdx++;
      }

      // Determine reference line for indentation
      let refLine = '';
      if (block.removals.length > 0 && sourceIdx < sourceLines.length) {
        refLine = sourceLines[sourceIdx];
      } else if (position > 0) {
        refLine = sourceLines[position - 1];
      }

      const baseIndent =
        block.additions.length > 0 ? getIndent(block.additions[0]) : '';

      // Add all additions with corrected indentation
      for (const addition of block.additions) {
        if (addition.trim() === '') {
          resultLines.push('');
        } else {
          resultLines.push(applyIndent(addition, refLine, baseIndent));
        }
      }

      // Skip the removal lines
      sourceIdx += block.removals.length;
    }

    // Copy remaining lines
    while (sourceIdx < sourceLines.length) {
      resultLines.push(sourceLines[sourceIdx]);
      sourceIdx++;
    }

    return {
      success: true,
      result: resultLines.join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      result: originalContent,
      error: `Unexpected error: ${String(error)}`,
    };
  }
}

/**
 * Validate diff format without applying
 */
export function validateDiff(diffContent: string): {
  valid: boolean;
  blockCount: number;
  error?: string;
} {
  try {
    const blocks = parseDiffBlocks(diffContent);

    if (blocks.length === 0) {
      return {
        valid: false,
        blockCount: 0,
        error: 'No valid diff blocks found',
      };
    }

    // Check each block has either removals or additions
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.removals.length === 0 && block.additions.length === 0) {
        return {
          valid: false,
          blockCount: blocks.length,
          error: `Block ${i + 1} has no changes`,
        };
      }
      if (block.contextBefore.length === 0 && block.removals.length === 0) {
        return {
          valid: false,
          blockCount: blocks.length,
          error: `Block ${i + 1} has no context or removals for positioning`,
        };
      }
    }

    return {
      valid: true,
      blockCount: blocks.length,
    };
  } catch (error) {
    return {
      valid: false,
      blockCount: 0,
      error: String(error),
    };
  }
}
