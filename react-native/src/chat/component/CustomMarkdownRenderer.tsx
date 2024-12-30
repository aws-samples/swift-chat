import React, {
  lazy,
  ReactElement,
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type ViewStyle,
  StyleSheet,
  Platform,
  TextStyle,
  Text,
  View,
  ScrollView,
  Dimensions,
  TextProps,
  ImageStyle,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Renderer } from 'react-native-marked';
import type { RendererInterface } from 'react-native-marked';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Table, Cell, TableWrapper } from 'react-native-table-component';
import RNFS from 'react-native-fs';
import MDSvg from 'react-native-marked/src/components/MDSvg.tsx';
import MDImage from 'react-native-marked/src/components/MDImage.tsx';
import ImageProgressBar from './ImageProgressBar.tsx';
import { PressMode } from '../../types/Chat.ts';
import Clipboard from '@react-native-clipboard/clipboard';
import MarkedList from '@jsamr/react-native-li';
import Decimal from '@jsamr/counter-style/lib/es/presets/decimal';
import Disc from '@jsamr/counter-style/lib/es/presets/disc';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import MathView from 'react-native-math-view';

const CustomCodeHighlighter = lazy(() => import('./CustomCodeHighlighter'));
const cachedNode: { [key: string]: React.ReactNode } = {};
let currentNodeType = '';
let currentCacheKey = '';
let currentText = '';
let currentNode: React.ReactNode;
let mathViewIndex = 0;

export function clearCachedNode() {
  Object.keys(cachedNode).forEach(key => delete cachedNode[key]);
}

function getMathKey() {
  mathViewIndex++;
  return 'math-' + mathViewIndex;
}

interface CopyButtonProps {
  onCopy: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = React.memo(
  ({ onCopy }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
      onCopy();
      setCopied(true);
    }, [onCopy]);

    // UseMemo to memoize the image source to prevent flickering
    const imageSource = useMemo(() => {
      return copied
        ? require('../../assets/done.png')
        : require('../../assets/copy.png');
    }, [copied]);

    useEffect(() => {
      if (copied) {
        const timer = setTimeout(() => {
          setCopied(false);
        }, 2000);

        return () => clearTimeout(timer);
      }
    }, [copied]);
    return (
      <TouchableOpacity
        style={customStyles.copyButtonLayout}
        onPress={handleCopy}>
        <Image source={imageSource} style={customStyles.copyButton} />
      </TouchableOpacity>
    );
  },
  () => true
);

const MemoizedCodeHighlighter = React.memo(
  ({ text, language }: { text: string; language?: string }) => {
    const handleCopy = useCallback(() => {
      Clipboard.setString(text);
    }, [text]);
    return (
      <View style={customStyles.container}>
        <View style={customStyles.header}>
          <Text style={customStyles.headerText}>
            {language === '' ? 'code' : language}
          </Text>
          <CopyButton onCopy={handleCopy} />
        </View>
        <Suspense
          fallback={<Text style={customStyles.loading}>Loading...</Text>}>
          <CustomCodeHighlighter
            hljsStyle={github}
            scrollViewProps={{
              contentContainerStyle: {
                padding: 12,
                minWidth: '100%',
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
              },
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              backgroundColor: '#F8F8F8',
            }}
            textStyle={customStyles.text}
            language={language ?? 'code'}>
            {text}
          </CustomCodeHighlighter>
        </Suspense>
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.text === nextProps.text &&
    prevProps.language === nextProps.language
);

export class CustomMarkdownRenderer
  extends Renderer
  implements RendererInterface
{
  private width = Dimensions.get('window').width;
  private height = Dimensions.get('window').height;

  constructor(
    private onImagePress: (pressMode: PressMode, url: string) => void
  ) {
    super();
  }

  private hashStringDjb2(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    // eslint-disable-next-line no-bitwise
    return hash >>> 0;
  }

  private checkCache(
    nodeType: string,
    cacheKey: string,
    text: string,
    node: React.ReactNode
  ) {
    if (currentNodeType === '') {
      currentNodeType = nodeType;
    }
    if (currentText === '') {
      currentText = text;
    }
    if (currentNodeType !== nodeType) {
      cachedNode[currentCacheKey] = currentNode;
      currentNodeType = nodeType;
    } else {
      if (text.length <= currentText.length) {
        if (!cachedNode[currentCacheKey]) {
          cachedNode[currentCacheKey] = currentNode;
        }
      }
    }
    currentCacheKey = cacheKey;
    currentNode = node;
    currentText = text;
  }

  getTextView(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    return (
      <Text selectable key={this.getKey()} style={styles}>
        {children}
      </Text>
    );
  }

  getNodeForTextArray(text: ReactNode[], styles?: TextStyle): ReactNode {
    if (text.length === 0) {
      return <></>;
    }
    if (text.length === 1) {
      return text[0];
    }
    return this.getTextView(text, styles);
  }

  codespan(text: string, styles?: TextStyle): ReactNode {
    const cacheKey = `codespan:${this.hashStringDjb2(text.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const codespan = this.getTextView(text, {
      ...styles,
      ...customStyles.codeSpanText,
    });
    this.checkCache('codespan', cacheKey, text.toString(), codespan);
    return codespan;
  }

  text(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(text)) {
      return this.getNodeForTextArray(text, styles);
    }
    const cacheKey = `text:${this.hashStringDjb2(text.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const textNode = this.getTextView(text, styles);
    this.checkCache('text', cacheKey, text.toString(), textNode);
    return textNode;
  }

  strong(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(children)) {
      return this.getNodeForTextArray(children, styles);
    }
    const cacheKey = `strong:${this.hashStringDjb2(children.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const strong = this.getTextView(children, styles);
    this.checkCache('strong', cacheKey, children.toString(), strong);
    return strong;
  }

  em(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(children)) {
      return this.getNodeForTextArray(children, styles);
    }
    const cacheKey = `em:${this.hashStringDjb2(children.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const em = this.getTextView(children, styles);
    this.checkCache('em', cacheKey, children.toString(), em);
    return em;
  }

  br(): ReactNode {
    const text = '\n';
    const cacheKey = `br:${this.hashStringDjb2(text)}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const br = this.getTextView(text, {});
    this.checkCache('br', cacheKey, text, br);
    return br;
  }

  del(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(children)) {
      return this.getNodeForTextArray(children, styles);
    }
    const cacheKey = `del:${this.hashStringDjb2(children.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const del = this.getTextView(children, styles);
    this.checkCache('del', cacheKey, children.toString(), del);
    return del;
  }

  heading(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(text)) {
      return this.getNodeForTextArray(text, styles);
    }
    const cacheKey = `heading:${this.hashStringDjb2(text.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const heading = this.getTextView(text, styles);
    this.checkCache('heading', cacheKey, text.toString(), heading);
    return heading;
  }

  escape(text: string, styles?: TextStyle): ReactNode {
    if (Array.isArray(text)) {
      return this.getNodeForTextArray(text, styles);
    }
    const cacheKey = `escape:${this.hashStringDjb2(text.toString())}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    const escape = this.getTextView(text, styles);
    this.checkCache('escape', cacheKey, text.toString(), escape);
    return escape;
  }

  image(uri: string, alt?: string, style?: ImageStyle): ReactNode {
    const key = this.getKey();
    if (uri.startsWith('bedrock://imgProgress')) {
      return <ImageProgressBar key={key} />;
    }
    if (uri.endsWith('.svg')) {
      return <MDSvg uri={uri} key={key} />;
    }
    const imgUrl = uri.startsWith('http')
      ? uri
      : Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath + '/' + uri
      : uri;
    return (
      <TouchableOpacity
        style={customStyles.imageContainer}
        activeOpacity={0.8}
        onPress={() => this.onImagePress(PressMode.Click, imgUrl)}
        onLongPress={() => this.onImagePress(PressMode.LongPress, imgUrl)}
        key={key}>
        <MDImage
          key={key}
          uri={imgUrl}
          alt={alt}
          style={{ ...style, ...customStyles.imageStyle }}
        />
      </TouchableOpacity>
    );
  }

  code(
    text: string,
    language?: string,
    _containerStyle?: ViewStyle,
    _textStyle?: TextStyle
  ): ReactNode {
    const cacheKey = `code:${language}:${this.hashStringDjb2(text)}`;
    if (cachedNode[cacheKey]) {
      return cachedNode[cacheKey];
    }
    if (text && text !== '') {
      const codeComponent = (
        <MemoizedCodeHighlighter
          key={this.getKey()}
          text={text}
          language={language}
        />
      );
      this.checkCache('code', cacheKey, text, codeComponent);
      return codeComponent;
    } else {
      return <></>;
    }
  }

  table(
    header: ReactNode[][],
    rows: ReactNode[][][],
    tableStyle?: ViewStyle,
    rowStyle?: ViewStyle,
    cellStyle?: ViewStyle
  ): React.ReactNode {
    const widthArr = getTableWidthArr(header.length, this.width, this.height);
    const { borderWidth, borderColor, ...tableStyleRest } = tableStyle || {};

    const headerTableStyle = {
      ...rowStyle,
      backgroundColor: '#f5f5f5',
    };

    return (
      <ScrollView horizontal={true}>
        <Table
          borderStyle={{ borderWidth, borderColor }}
          style={tableStyleRest}>
          <TableWrapper style={headerTableStyle}>
            {header.map((headerCol, index) => {
              if (React.isValidElement(headerCol[0])) {
                headerCol[0] = React.cloneElement(
                  headerCol[0] as ReactElement<TextProps>,
                  {
                    style: {
                      ...headerCol[0].props.style,
                      fontWeight: '500',
                    },
                  }
                );
              }
              return (
                <Cell
                  width={widthArr[index]}
                  style={customStyles.cell}
                  key={`${index}`}
                  data={<View style={cellStyle}>{headerCol}</View>}
                />
              );
            })}
          </TableWrapper>
          {rows.map((rowData, index) => {
            return (
              <TableWrapper key={`${index}`} style={rowStyle}>
                {rowData.map((cellData, cellIndex) => {
                  return (
                    <Cell
                      width={widthArr[cellIndex]}
                      style={customStyles.cell}
                      key={`${cellIndex}`}
                      data={<View style={cellStyle}>{cellData}</View>}
                    />
                  );
                })}
              </TableWrapper>
            );
          })}
        </Table>
      </ScrollView>
    );
  }

  list(
    ordered: boolean,
    li: ReactNode[],
    listStyle?: ViewStyle,
    textStyle?: TextStyle,
    startIndex?: number
  ): ReactNode {
    return (
      <MarkedList
        counterRenderer={ordered ? Decimal : Disc}
        markerTextStyle={textStyle}
        markerBoxStyle={listStyle}
        enableMarkerClipping={true}
        key={this.getKey()}
        startIndex={startIndex}>
        {li.map(node => node)}
      </MarkedList>
    );
  }

  custom(
    identifier: string,
    _raw: string,
    _children?: ReactNode[],
    args?: Record<string, unknown>
  ): ReactNode {
    if (identifier === 'latex') {
      const text = args?.text as string;
      const isDisplayMode = args?.displayMode as boolean;
      const mathView = (
        <MathView
          key={getMathKey()}
          math={text}
          style={
            isDisplayMode
              ? customStyles.displayMathView
              : customStyles.inlineMathView
          }
        />
      );

      return (
        <View
          key={getMathKey()}
          style={
            isDisplayMode ? customStyles.displayMath : customStyles.inlineMath
          }>
          {isDisplayMode ? (
            <ScrollView
              key={getMathKey()}
              horizontal={true}
              showsHorizontalScrollIndicator={false}>
              {mathView}
            </ScrollView>
          ) : (
            mathView
          )}
        </View>
      );
    }
    return null;
  }
}

const getTableWidthArr = (
  totalCols: number,
  windowWidth: number,
  windowHeight: number
) => {
  if (totalCols < 1) {
    return [];
  }

  return Array(totalCols)
    .fill(0)
    .map(() => {
      if (windowHeight > windowWidth) {
        return Math.min(Math.floor((windowWidth - 64) * (1 / 2)), 170);
      } else {
        return Math.min(Math.floor((windowWidth - 182) * (1 / 5)), 170);
      }
    });
};

const customStyles = StyleSheet.create({
  text: {
    fontSize: 12,
    paddingVertical: 1.3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
  },
  codeSpanContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    paddingVertical: 1,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  codeSpanText: {
    fontStyle: 'normal',
    backgroundColor: '#f5f5f5',
    fontSize: 16,
  },
  imageContainer: {
    marginVertical: 4,
    maxWidth: 400,
    maxHeight: 400,
  },
  imageStyle: {
    borderRadius: 8,
  },
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9F9F9',
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerText: {
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#333333',
  },
  copyButtonLayout: {
    padding: 10,
    marginLeft: 'auto',
  },
  copyButton: {
    width: 18,
    height: 18,
  },
  loading: {
    padding: 12,
  },
  cell: {
    minHeight: 32,
  },
  displayMath: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  inlineMath: {
    marginTop: Platform.OS === 'android' ? 0 : 2,
    maxHeight: 24,
  },
  displayMathView: {
    marginVertical: 0,
    alignSelf: 'center',
  },
  inlineMathView: {},
});
