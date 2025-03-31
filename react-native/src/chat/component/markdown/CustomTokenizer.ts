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
          tokens: MarkedLexer(text),
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
    const latex = this.processLatex(src);
    if (latex && latex.token) {
      return latex.token;
    }
    const res = this.processDollarLatex(src, true);
    if (res) {
      return res;
    }
    return super.paragraph(src);
  }

  private processDollarLatex(
    src: string,
    forParagraph: boolean = false
  ): CustomToken | null {
    // Check for $$...$$ format (display mode)
    const displayDollarRegex = /\$\$([\s\S]+?)\$\$/;
    const displayDollarMatch = src.match(displayDollarRegex);

    if (displayDollarMatch) {
      return this.processLatexInText(
        src,
        displayDollarMatch,
        true,
        forParagraph,
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
        forParagraph,
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
    forParagraph: boolean,
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
    const afterTokens = afterFormula ? MarkedLexer(afterFormula) : [];

    // Create LaTeX token
    const latexToken: CustomToken = {
      type: 'custom',
      raw: formula,
      identifier: 'latex',
      tokens: MarkedLexer(formulaContent),
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
      type: forParagraph ? 'paragraph' : 'text',
      raw: src,
      text: src,
      tokens: [
        ...beforeTokens.flatMap(token =>
          token.type === 'paragraph' ? token.tokens || [] : [token]
        ),
        ...(isDisplayMode ? [{ type: 'br', raw: '  \n' }] : []),
        latexToken,
        ...(isDisplayMode ? [{ type: 'br', raw: '  \n' }] : []),
        ...afterTokens.flatMap(token =>
          token.type === 'paragraph' ? token.tokens || [] : [token]
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
