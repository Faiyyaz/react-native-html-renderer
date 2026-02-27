/* eslint-disable react-native/no-inline-styles */
import React, { memo, useCallback, useMemo } from "react";
import {
  Dimensions,
  FlatList,
  Linking,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";
import { parseDocument } from "htmlparser2";
import { Image } from "expo-image";

const { width: screenWidth } = Dimensions.get("window");
const HEADING_RATIOS: Record<string, number> = {
  h1: 2.25,
  h2: 1.875,
  h3: 1.5,
  h4: 1.25,
  h5: 1.1,
  h6: 1,
};
const SYSTEM_MONO = Platform.select({
  ios: "Courier",
  android: "monospace",
  default: "monospace",
});
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "aside",
  "main",
  "label",
]);
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type SpacingKey =
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft";
type HtmlNode = {
  type?: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string | undefined>;
  children?: HtmlNode[];
};

type InlineStyles = {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right" | "justify" | "auto";
  letterSpacing?: number;
  lineHeight?: number;
  isLineHeightRatio?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  isMonospace?: boolean;
  isSub?: boolean;
  isSup?: boolean;
  isRTL?: boolean;
  href?: string;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  blockIndent?: number;
};

type Segment = { text: string; styles: InlineStyles };

type Block =
  | { type: "paragraph"; content: Segment[] }
  | { type: "heading"; content: Segment[] }
  | {
      type: "list-item";
      content: Segment[];
      listType: "ul" | "ol";
      index: number;
      depth: number;
    }
  | { type: "blockquote"; content: Segment[] }
  | { type: "pre-block"; content: Segment[] }
  | { type: "divider" }
  | { type: "image"; src: string; initialRatio: number };

type Theme = {
  fonts: { base: string };
  colors: {
    text: string;
    background: string;
    link: string;
    quoteBar: string;
    quoteBg: string;
  };
};

type LayoutBudget = { padding: number; availableWidth: number };

type Props = {
  html: string;
  fontBaseName?: string;
  baseFontSize?: number;
  tagStyles?: Partial<Record<HeadingTag, InlineStyles>>;
  containerStyle?: StyleProp<ViewStyle>;
  onImagePress?: (src: string, ratio: number) => void;
  onLinkPress?: (href: string) => void | Promise<void>;
  /** Set to false when nested inside ScrollView to avoid scroll conflicts */
  scrollEnabled?: boolean;
};

const isElement = (
  node: HtmlNode,
): node is HtmlNode & { type: "tag"; name: string } =>
  node.type === "tag" && typeof node.name === "string";
const isTextNode = (
  node: HtmlNode,
): node is HtmlNode & { type: "text"; data: string } =>
  node.type === "text" && typeof node.data === "string";

const parseCssLength = (raw: string): number | undefined => {
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (/^-?\d+(\.\d+)?px$/.test(value)) return Number(value.replace("px", ""));
  return undefined;
};

const getFontFamily = (
  base: string,
  isBold?: boolean,
  isItalic?: boolean,
  isMonospace?: boolean,
): string | undefined => {
  if (isMonospace) return SYSTEM_MONO;
  if (base === "System") return undefined;
  if (isBold && isItalic) return `${base}-BoldItalic`;
  if (isBold) return `${base}-Bold`;
  if (isItalic) return `${base}-Italic`;
  return `${base}-Regular`;
};

const parseInlineStyle = (styleStr?: string): InlineStyles => {
  if (!styleStr) return {};
  const styles: InlineStyles = {};

  styleStr.split(";").forEach((entry) => {
    if (!entry.includes(":")) return;
    const [rawProp, rawVal] = entry.split(":");
    const prop = rawProp.trim().toLowerCase();
    const val = rawVal.trim();
    const valLower = val.toLowerCase();

    if (prop === "margin" || prop === "padding") {
      const parts = valLower.split(/\s+/).map(parseCssLength);
      if (parts.some((p) => typeof p !== "number")) return;
      const [a, b, c, d] =
        parts.length === 1
          ? [parts[0], parts[0], parts[0], parts[0]]
          : parts.length === 2
            ? [parts[0], parts[1], parts[0], parts[1]]
            : parts.length === 3
              ? [parts[0], parts[1], parts[2], parts[1]]
              : [parts[0], parts[1], parts[2], parts[3]];
      const prefix = prop as "margin" | "padding";
      if (prefix === "margin") {
        styles.marginTop = a;
        styles.marginRight = b;
        styles.marginBottom = c;
        styles.marginLeft = d;
      } else {
        styles.paddingTop = a;
        styles.paddingRight = b;
        styles.paddingBottom = c;
        styles.paddingLeft = d;
      }
      return;
    }

    if (prop === "color") styles.color = val;
    if (prop === "background-color") styles.backgroundColor = val;

    if (prop === "font-size") {
      const n = parseCssLength(valLower);
      if (typeof n === "number") styles.fontSize = n;
    }

    if (
      prop === "text-align" &&
      ["left", "center", "right", "justify", "auto"].includes(valLower)
    ) {
      styles.textAlign = valLower as InlineStyles["textAlign"];
    }

    if (prop === "letter-spacing") {
      const n = parseCssLength(valLower);
      if (typeof n === "number") styles.letterSpacing = n;
    }
    if (prop === "text-indent") {
      const n = parseCssLength(valLower);
      if (typeof n === "number") styles.blockIndent = n;
    }

    if (prop === "line-height") {
      const n =
        parseCssLength(valLower) ??
        (Number.isFinite(Number(valLower)) ? Number(valLower) : undefined);
      if (typeof n === "number") {
        styles.lineHeight = n;
        styles.isLineHeightRatio = n > 0 && n < 5;
      }
    }

    if (prop === "font-weight") {
      const numeric = Number(valLower);
      if (
        valLower === "bold" ||
        valLower === "bolder" ||
        (!Number.isNaN(numeric) && numeric >= 600)
      ) {
        styles.isBold = true;
      }
    }
    if (prop === "font-style" && valLower === "italic") styles.isItalic = true;

    if (prop === "text-decoration" || prop === "text-decoration-line") {
      if (valLower.includes("underline")) styles.underline = true;
      if (valLower.includes("line-through")) styles.strikethrough = true;
    }

    if (prop.startsWith("margin-") || prop.startsWith("padding-")) {
      const n = parseCssLength(valLower);
      if (typeof n !== "number") return;
      const camel = prop.replace(/-([a-z])/g, (_, p1: string) =>
        p1.toUpperCase(),
      ) as SpacingKey;
      if (
        camel === "marginTop" ||
        camel === "marginRight" ||
        camel === "marginBottom" ||
        camel === "marginLeft" ||
        camel === "paddingTop" ||
        camel === "paddingRight" ||
        camel === "paddingBottom" ||
        camel === "paddingLeft"
      ) {
        styles[camel] = n;
      }
    }
  });

  return styles;
};

const parseIndentFromClassName = (className?: string): number | undefined => {
  if (!className) return undefined;

  // Quill-like output: ql-indent-1, ql-indent-2 ...
  const quillMatch = className.match(/(?:^|\s)ql-indent-(\d+)(?=\s|$)/i);
  if (quillMatch?.[1]) return Number(quillMatch[1]) * 24;

  // Generic editor class fallback: indent-1 / se-indent-1 / ck-indent-1
  const genericMatch = className.match(
    /(?:^|\s)(?:se-|ck-)?indent-(\d+)(?=\s|$)/i,
  );
  if (genericMatch?.[1]) return Number(genericMatch[1]) * 24;

  return undefined;
};

const hasRtlClass = (className?: string): boolean => {
  if (!className) return false;
  return /(?:^|\s)(?:ql-direction-rtl|se-rtl|ck-rtl|rtl)(?=\s|$)/i.test(
    className,
  );
};

const normalizeText = (raw: string, preserveWhitespace: boolean): string => {
  const sanitized = raw.replace(/\u200B/g, "");
  if (preserveWhitespace) return sanitized;
  return sanitized.replace(/\s+/g, " ");
};

const sanitizeUrl = (href?: string): string | undefined => {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("#")) return undefined;

  try {
    const url = new URL(trimmed);
    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) return undefined;
    return trimmed;
  } catch {
    if (trimmed.startsWith("/")) return undefined;
    if (/^(mailto:|tel:)/i.test(trimmed)) return trimmed;
    return undefined;
  }
};

const splitTextByAutoLinks = (
  text: string,
  baseStyles: InlineStyles,
): Segment[] => {
  // Matches http(s), www.* and simple emails inside plain text content.
  const linkRegex =
    /(https?:\/\/[^\s<]+|www\.[^\s<]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  match = linkRegex.exec(text);
  while (match) {
    const matchText = match[0];
    const start = match.index;
    const end = start + matchText.length;

    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), styles: baseStyles });
    }

    const href = matchText.includes("@")
      ? `mailto:${matchText}`
      : matchText.startsWith("www.")
        ? `https://${matchText}`
        : matchText;
    const safeHref = sanitizeUrl(href);

    if (safeHref) {
      segments.push({
        text: matchText,
        styles: { ...baseStyles, href: safeHref },
      });
    } else {
      segments.push({ text: matchText, styles: baseStyles });
    }

    lastIndex = end;
    match = linkRegex.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), styles: baseStyles });
  }

  return segments.length ? segments : [{ text, styles: baseStyles }];
};

const RenderText = memo(function RenderText({
  segments,
  theme,
  baseFontSize,
  onLinkPress,
}: {
  segments: Segment[];
  theme: Theme;
  baseFontSize: number;
  onLinkPress?: (href: string) => void | Promise<void>;
}) {
  const blockAlign =
    segments[0]?.styles?.textAlign ||
    (segments[0]?.styles?.isRTL ? "right" : "left");

  const handleLinkPress = useCallback(
    async (href: string) => {
      const safeHref = sanitizeUrl(href);
      if (!safeHref) return;
      if (onLinkPress) {
        await onLinkPress(safeHref);
        return;
      }
      await Linking.openURL(safeHref);
    },
    [onLinkPress],
  );

  return (
    <Text allowFontScaling={false} style={{ textAlign: blockAlign }}>
      {segments.map((seg, i) => {
        const s = seg.styles;
        const fSize = s.fontSize || baseFontSize;
        const lHeight =
          s.isLineHeightRatio && s.lineHeight
            ? s.lineHeight * fSize
            : s.lineHeight;
        let decoration:
          | "none"
          | "underline"
          | "line-through"
          | "underline line-through" = "none";
        if (s.underline && s.strikethrough)
          decoration = "underline line-through";
        else if (s.underline) decoration = "underline";
        else if (s.strikethrough) decoration = "line-through";

        return (
          <Text
            allowFontScaling={false}
            key={i}
            style={[
              {
                fontFamily: getFontFamily(
                  theme.fonts.base,
                  s.isBold,
                  s.isItalic,
                  s.isMonospace,
                ),
                fontSize: fSize,
                color: s.color || theme.colors.text,
                lineHeight: lHeight,
                letterSpacing: s.letterSpacing,
                backgroundColor: s.backgroundColor || "transparent",
                textDecorationLine: decoration,
              },
              s.isBold &&
                theme.fonts.base === "System" && { fontWeight: "bold" },
              s.isItalic &&
                theme.fonts.base === "System" && { fontStyle: "italic" },
              s.isSub && {
                fontSize: fSize * 0.7,
                transform: [{ translateY: fSize * 0.2 }],
              },
              s.isSup && {
                fontSize: fSize * 0.7,
                transform: [{ translateY: -fSize * 0.2 }],
              },
              s.href && {
                color: theme.colors.link,
                textDecorationLine: "underline",
              },
            ]}
            onPress={s.href ? () => handleLinkPress(s.href!) : undefined}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
});

export default function HTMLRenderer(props: Props) {
  const {
    html,
    fontBaseName = "System",
    baseFontSize = 16,
    tagStyles,
    containerStyle,
    onImagePress,
    onLinkPress,
    scrollEnabled = true,
  } = props;
  const isDark = useColorScheme() === "dark";

  const theme = useMemo<Theme>(
    () => ({
      fonts: { base: fontBaseName },
      colors: {
        text: isDark ? "#E0E0E0" : "#222",
        background: isDark ? "#121212" : "#FFF",
        link: isDark ? "#4dabf7" : "#007AFF",
        quoteBar: isDark ? "#444" : "#ccc",
        quoteBg: isDark ? "#1A1A1A" : "#F9F9F9",
      },
    }),
    [fontBaseName, isDark],
  );

  const resolvedContainerStyle = StyleSheet.flatten(containerStyle) ?? {};

  const layoutBudget = useMemo<LayoutBudget>(() => {
    const pad =
      resolvedContainerStyle.paddingHorizontal ??
      resolvedContainerStyle.paddingLeft ??
      16;
    return {
      padding: Number(pad),
      availableWidth: screenWidth - Number(pad) * 2,
    };
  }, [
    resolvedContainerStyle.paddingHorizontal,
    resolvedContainerStyle.paddingLeft,
  ]);

  const data = useMemo<Block[]>(() => {
    const safeTagStyles: Partial<Record<HeadingTag, InlineStyles>> =
      tagStyles ?? {};
    const doc = parseDocument(html, { decodeEntities: true }) as unknown as {
      children?: HtmlNode[];
    };
    const blocks: Block[] = [];
    let currentParagraph: Segment[] = [];

    const flushListItem = (
      listType: "ul" | "ol",
      index: number,
      depth: number,
    ) => {
      if (!currentParagraph.length) return;
      blocks.push({
        type: "list-item",
        content: [...currentParagraph],
        listType,
        index,
        depth,
      });
      currentParagraph = [];
    };

    const flush = (type: Exclude<Block["type"], "list-item"> = "paragraph") => {
      if (!currentParagraph.length) return;
      if (
        type === "heading" ||
        type === "paragraph" ||
        type === "blockquote" ||
        type === "pre-block"
      ) {
        blocks.push({ type, content: [...currentParagraph] });
      }
      currentParagraph = [];
    };

    const pushText = (
      rawText: string,
      styles: InlineStyles,
      inPre: boolean,
    ) => {
      const text = normalizeText(rawText, inPre);
      if (!inPre && (text === "" || text === " ")) return;
      if (!inPre && !styles.href) {
        currentParagraph.push(...splitTextByAutoLinks(text, styles));
        return;
      }
      currentParagraph.push({ text, styles });
    };

    const traverse = (
      nodes: HtmlNode[] | undefined,
      styles: InlineStyles = {},
      listDepth = 0,
      inPre = false,
    ) => {
      if (!nodes) return;

      nodes.forEach((child: HtmlNode) => {
        if (isTextNode(child)) {
          pushText(child.data, styles, inPre);
          return;
        }
        if (!isElement(child)) return;

        const tag = child.name.toLowerCase();
        let newStyles: InlineStyles = { ...styles };

        if (child.attribs?.style) {
          newStyles = {
            ...newStyles,
            ...parseInlineStyle(child.attribs.style),
          };
        }
        const classIndent = parseIndentFromClassName(child.attribs?.class);
        if (typeof classIndent === "number") {
          newStyles.blockIndent = classIndent;
        }
        if (hasRtlClass(child.attribs?.class)) {
          newStyles.isRTL = true;
        }
        if (child.attribs?.dir === "rtl") {
          newStyles.isRTL = true;
        }

        if (
          tag === "script" ||
          tag === "style" ||
          tag === "form" ||
          tag === "input" ||
          tag === "textarea" ||
          tag === "button"
        ) {
          return;
        }

        if (/^h[1-6]$/.test(tag)) {
          flush();
          const headingTag = tag as HeadingTag;
          newStyles.fontSize = baseFontSize * (HEADING_RATIOS[headingTag] || 1);
          newStyles.isBold = true;
          const headingStyle = safeTagStyles[headingTag];
          if (headingStyle) {
            newStyles = { ...newStyles, ...headingStyle };
          }
          traverse(child.children, newStyles, listDepth, false);
          flush("heading");
          return;
        }

        if (tag === "br") {
          pushText("\n", newStyles, true);
          return;
        }

        if (tag === "pre") {
          flush();
          traverse(
            child.children,
            { ...newStyles, isMonospace: true },
            listDepth,
            true,
          );
          flush("pre-block");
          return;
        }

        if (tag === "code") {
          traverse(
            child.children,
            { ...newStyles, isMonospace: true },
            listDepth,
            inPre,
          );
          return;
        }

        if (tag === "ul" || tag === "ol") {
          let counter = 0;
          child.children
            .filter(
              (c: HtmlNode): c is HtmlNode & { type: "tag"; name: string } =>
                isElement(c) && c.name.toLowerCase() === "li",
            )
            .forEach((li) => {
              counter += 1;
              flush();
              traverse(li.children, newStyles, listDepth + 1, false);
              flushListItem(tag, counter, listDepth);
            });
          return;
        }

        if (tag === "blockquote") {
          flush();
          traverse(
            child.children,
            { ...newStyles, isItalic: true },
            listDepth,
            false,
          );
          flush("blockquote");
          return;
        }

        if (tag === "img") {
          flush();
          const src = child.attribs?.src;
          if (!src) return;
          const width = Number(child.attribs?.width);
          const height = Number(child.attribs?.height);
          const initialRatio =
            width > 0 && height > 0 ? width / height : 16 / 9;
          blocks.push({ type: "image", src, initialRatio });
          return;
        }

        if (tag === "hr") {
          flush();
          blocks.push({ type: "divider" });
          return;
        }

        if (tag === "a") {
          const safeHref = sanitizeUrl(child.attribs?.href);
          newStyles.href = safeHref;
          traverse(child.children, newStyles, listDepth, inPre);
          return;
        }

        if (tag === "strong" || tag === "b") newStyles.isBold = true;
        if (tag === "em" || tag === "i") newStyles.isItalic = true;
        if (tag === "u") newStyles.underline = true;
        if (tag === "s" || tag === "strike" || tag === "del")
          newStyles.strikethrough = true;
        if (tag === "sub") newStyles.isSub = true;
        if (tag === "sup") newStyles.isSup = true;

        if (BLOCK_TAGS.has(tag)) {
          flush();
          traverse(child.children, newStyles, listDepth, inPre);
          flush();
          return;
        }

        traverse(child.children, newStyles, listDepth, inPre);
      });
    };

    traverse(doc.children);
    flush();
    return blocks;
  }, [html, baseFontSize, tagStyles]);

  const renderItem = useCallback(
    ({ item }: { item: Block }) => {
      const blockInlineStyles =
        "content" in item && item.content?.length ? item.content[0].styles : {};
      const dynamicStyles = {
        marginTop: blockInlineStyles.marginTop ?? 8,
        marginBottom: blockInlineStyles.marginBottom ?? 8,
        marginLeft:
          (blockInlineStyles.marginLeft ?? 0) +
          (blockInlineStyles.isRTL ? 0 : (blockInlineStyles.blockIndent ?? 0)),
        marginRight:
          (blockInlineStyles.marginRight ?? 0) +
          (blockInlineStyles.isRTL ? (blockInlineStyles.blockIndent ?? 0) : 0),
        paddingTop: blockInlineStyles.paddingTop ?? 0,
        paddingBottom: blockInlineStyles.paddingBottom ?? 0,
        paddingLeft: blockInlineStyles.paddingLeft ?? 0,
        paddingRight: blockInlineStyles.paddingRight ?? 0,
      };

      const baseStyle = [
        { paddingHorizontal: layoutBudget.padding },
        dynamicStyles,
      ];

      if (item.type === "pre-block") {
        return (
          <View
            style={[
              baseStyle,
              styles.preBlock,
              { backgroundColor: theme.colors.quoteBg },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <RenderText
                segments={item.content}
                theme={theme}
                baseFontSize={Math.max(12, baseFontSize - 2)}
                onLinkPress={onLinkPress}
              />
            </ScrollView>
          </View>
        );
      }

      if (item.type === "image") {
        return (
          <TouchableOpacity
            disabled={!onImagePress}
            onPress={() =>
              item.src && onImagePress?.(item.src, item.initialRatio)
            }
            style={baseStyle}
          >
            <Image
              source={{ uri: item.src }}
              style={{ width: "100%", aspectRatio: item.initialRatio }}
              contentFit="contain"
              transition={300}
            />
          </TouchableOpacity>
        );
      }

      if (item.type === "divider") {
        return (
          <View
            style={[
              { paddingHorizontal: layoutBudget.padding, marginVertical: 10 },
            ]}
          >
            <View
              style={{
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.colors.quoteBar,
              }}
            />
          </View>
        );
      }

      if (item.type === "list-item") {
        return (
          <View
            style={[
              baseStyle,
              {
                flexDirection: "row",
                paddingLeft: layoutBudget.padding + item.depth * 20,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: getFontFamily(theme.fonts.base, true),
                color: theme.colors.text,
                width: 25,
                fontSize: baseFontSize,
              }}
            >
              {item.listType === "ol" ? `${item.index}.` : "\u2022"}
            </Text>
            <View style={{ flex: 1 }}>
              <RenderText
                segments={item.content}
                theme={theme}
                baseFontSize={baseFontSize}
                onLinkPress={onLinkPress}
              />
            </View>
          </View>
        );
      }

      if (item.type === "blockquote") {
        return (
          <View
            style={[
              baseStyle,
              styles.quote,
              {
                backgroundColor: theme.colors.quoteBg,
                borderLeftWidth: 4,
                borderColor: theme.colors.quoteBar,
              },
            ]}
          >
            <RenderText
              segments={item.content}
              theme={theme}
              baseFontSize={baseFontSize}
              onLinkPress={onLinkPress}
            />
          </View>
        );
      }

      if (item.type === "heading" || item.type === "paragraph") {
        return (
          <View style={baseStyle}>
            <RenderText
              segments={item.content}
              theme={theme}
              baseFontSize={baseFontSize}
              onLinkPress={onLinkPress}
            />
          </View>
        );
      }

      return null;
    },
    [baseFontSize, layoutBudget, onImagePress, onLinkPress, theme],
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(_, index) => `block-${index}`}
      removeClippedSubviews={Platform.OS === "android"}
      windowSize={11}
      initialNumToRender={8}
      scrollEnabled={scrollEnabled}
      nestedScrollEnabled
      style={[{ backgroundColor: theme.colors.background }, containerStyle]}
    />
  );
}

const styles = StyleSheet.create({
  preBlock: {
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
  },
  quote: {
    padding: 12,
    marginVertical: 10,
  },
});
