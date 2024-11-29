import { CustomToken, MarkedTokenizer } from 'react-native-marked';

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
}
