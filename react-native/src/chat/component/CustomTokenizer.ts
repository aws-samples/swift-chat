import { CustomToken, MarkedLexer, MarkedTokenizer } from 'react-native-marked';

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
        const isDisplayMode = !!displayMatch;

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

  paragraph(src: string) {
    const latex = this.processLatex(src);
    if (latex) {
      return latex.token;
    }
    return super.paragraph(src);
  }

  text(src: string) {
    return super.text(src);
  }

  escape(src: string) {
    const latex = this.processLatex(src);
    if (latex) {
      return latex.token;
    }
    return super.escape(src);
  }
}
