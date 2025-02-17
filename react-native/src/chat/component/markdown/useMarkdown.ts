import { useMemo, type ReactNode } from 'react';
import { type Tokenizer, marked } from 'marked';
import type {
  MarkedStyles,
  UserTheme,
} from 'react-native-marked/src/theme/types';
import Parser from 'react-native-marked/src/lib/Parser';
import Renderer from 'react-native-marked/src/lib/Renderer';
import getStyles from 'react-native-marked/src/theme/styles';
import type { ColorSchemeName } from 'react-native';
import type {
  CustomToken,
  RendererInterface,
} from 'react-native-marked/src/lib/types';

export interface useMarkdownHookOptions {
  colorScheme?: ColorSchemeName;
  renderer?: RendererInterface;
  theme?: UserTheme;
  styles?: MarkedStyles;
  baseUrl?: string;
  tokenizer?: Tokenizer<CustomToken>;
}

const useMarkdown = (
  value: string,
  options?: useMarkdownHookOptions
): ReactNode[] => {
  const styles = useMemo(
    () => getStyles(options?.styles, options?.colorScheme, options?.theme),
    [options?.styles, options?.theme, options?.colorScheme]
  );

  const parser = useMemo(
    () =>
      new Parser({
        styles: styles,
        baseUrl: options?.baseUrl,
        renderer: options?.renderer ?? new Renderer(),
      }),
    [options?.renderer, options?.baseUrl, styles]
  );

  const elements = useMemo(() => {
    const tokens = marked.lexer(value, {
      gfm: true,
      tokenizer: options?.tokenizer as Tokenizer<never>,
    });
    console.log('-----------', tokens);
    return parser.parse(tokens);
  }, [value, parser, options?.tokenizer]);

  return elements;
};

export default useMarkdown;
