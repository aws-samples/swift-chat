import { CustomToken, MarkedLexer, MarkedTokenizer } from 'react-native-marked';
import { Platform } from 'react-native';

export class CustomTokenizer extends MarkedTokenizer<CustomToken> {
  list(this: MarkedTokenizer<CustomToken>, src: string) {
    const len = src.length;
    if (len < 4) {
      return super.list(src);
    }
    if (
      (src[len - 1] === '-' && src[len - 2] === ' ' && src[len - 3] === ' ') ||
      (src[len - 1] === ' ' &&
        src[len - 2] === '-' &&
        src[len - 3] === ' ' &&
        src[len - 4] === ' ')
    ) {
      const position = src[len - 1] === '-' ? len - 1 : len - 2;
      return super.list(src.slice(0, position) + '*' + src.slice(position + 1));
    }
    return super.list(src);
  }

  processLatex(src: string): { token: CustomToken | null; raw: string } | null {
    // match \(...\) and \[...\]
    const inlineMatch = src.match(/^\\\(([\s\S]+?)\\\)/);
    const displayMatch = src.match(/^\\\[([\s\S]+?)\\]/);
    if (inlineMatch || displayMatch) {
      const match = inlineMatch || displayMatch;
      if (match && match.length > 1) {
        const text = match[1].trim();
        let isDisplayMode = !!displayMatch;
        if (isDisplayMode && Platform.OS === 'android') {
          if (!src.includes('\n\n') && src.includes('\n')) {
            isDisplayMode = false;
          }
        }
        const token: CustomToken = {
          type: 'custom',
          raw: match[0],
          identifier: 'latex',
          args: {
            text: text,
            displayMode: isDisplayMode,
          },
        };
        return { token, raw: match[0] };
      }
    }
    return null;
  }

  paragraph(
    src: string
  ): ReturnType<MarkedTokenizer<CustomToken>['paragraph']> {
    return super.paragraph(src);
  }

  private processDollarLatex(src: string): CustomToken | null {
    // Check for $$...$$ format (display mode)
    const displayDollarRegex = /\$\$([\s\S]+?)\$\$/;
    const displayDollarMatch = src.match(displayDollarRegex);

    if (displayDollarMatch) {
      return this.processLatexInText(
        src,
        displayDollarMatch,
        true,
        (displaySrc, match) => {
          const startIndex = displaySrc.indexOf('$$');
          const endIndex = displaySrc.indexOf('$$', startIndex + 2) + 2;
          return {
            beforeFormula: displaySrc.substring(0, startIndex),
            formula: match[0],
            formulaContent: match[1],
            afterFormula: displaySrc.substring(endIndex),
          };
        }
      ) as CustomToken;
    }

    // Check for $...$ format (inline mode)
    const inlineDollarRegex = /([^$]|^)\$([^$\n]+?)\$([^$]|$)/;
    const inlineDollarMatch = src.match(inlineDollarRegex);

    if (inlineDollarMatch) {
      return this.processLatexInText(
        src,
        inlineDollarMatch,
        false,
        (inlineSrc, match) => {
          const fullMatch = match[0];
          const startPos = inlineSrc.indexOf(fullMatch);
          const dollarPos = fullMatch.indexOf('$');
          const lastDollarPos = fullMatch.lastIndexOf('$');
          return {
            beforeFormula: inlineSrc.substring(0, startPos + dollarPos),
            formula:
              '$' + fullMatch.substring(dollarPos + 1, lastDollarPos) + '$',
            formulaContent: fullMatch.substring(dollarPos + 1, lastDollarPos),
            afterFormula: inlineSrc.substring(startPos + lastDollarPos + 1),
          };
        }
      ) as CustomToken;
    }
    return null;
  }

  private processLatexInText(
    src: string,
    match: RegExpMatchArray,
    isDisplayMode: boolean,
    extractParts: (
      src: string,
      match: RegExpMatchArray
    ) => {
      beforeFormula: string;
      formula: string;
      formulaContent: string;
      afterFormula: string;
    }
  ): ReturnType<MarkedTokenizer<CustomToken>['text']> {
    const { beforeFormula, formula, formulaContent, afterFormula } =
      extractParts(src, match);

    // Parse before and after text into tokens
    const beforeTokens = beforeFormula ? MarkedLexer(beforeFormula) : [];
    let afterTokens;
    if (afterFormula.includes('$')) {
      afterTokens = afterFormula ? this.text(afterFormula) : [];
    } else {
      afterTokens = afterFormula ? MarkedLexer(afterFormula) : [];
    }
    if (isDisplayMode) {
      if (!(beforeFormula.endsWith('\n') || afterFormula.startsWith('\n'))) {
        isDisplayMode = false;
      }
    }

    // Create LaTeX token
    const latexToken: CustomToken = {
      type: 'custom',
      raw: formula,
      identifier: 'latex',
      args: {
        text: formulaContent.trim(),
        displayMode: isDisplayMode,
      },
    };

    // If no surrounding text, return just the LaTeX token
    if (!beforeFormula && !afterFormula) {
      return latexToken;
    }

    // Create a text token containing all parts
    return {
      type: 'text',
      raw: src,
      text: src,
      tokens: [
        ...beforeTokens.flatMap(token =>
          token.type === 'paragraph' ? token.tokens || [] : [token]
        ),
        ...(isDisplayMode ||
        (beforeFormula.length > 1 && beforeFormula.endsWith('\n'))
          ? [{ type: 'br', raw: '  \n' }]
          : []),
        latexToken,
        ...((isDisplayMode && afterFormula.length > 1) ||
        (afterFormula.length > 1 && afterFormula.startsWith('\n'))
          ? [{ type: 'br', raw: '  \n' }]
          : []),
        ...(Array.isArray(afterTokens) ? afterTokens : [afterTokens]).flatMap(
          token => {
            if (!token) {
              return [];
            }
            if (
              typeof token === 'object' &&
              'tokens' in token &&
              Array.isArray(token.tokens)
            ) {
              return token.tokens;
            }
            return [token];
          }
        ),
      ],
    } as ReturnType<MarkedTokenizer<CustomToken>['text']>;
  }

  text(src: string): ReturnType<MarkedTokenizer<CustomToken>['text']> {
    const res = this.processDollarLatex(src);
    if (res) {
      return res;
    }
    return super.text(src);
  }

  escape(src: string): ReturnType<MarkedTokenizer<CustomToken>['escape']> {
    const latex = this.processLatex(src);
    if (latex && latex.token) {
      return latex.token;
    }
    return super.escape(src);
  }
}
