import React from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { getAssetUrl } from "@/services/api/client";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import type { QuestionAsset } from "@/types/questions";

type ContentPart = { type: "text"; key: string; value: string } | { type: "image"; key: string; asset: QuestionAsset };

const assetId = (asset: QuestionAsset) => String(asset.tempId || asset.id || "").trim();

const assetUri = (asset: QuestionAsset): string => {
  const raw = String(asset.url || asset.base64 || "").trim();
  if (!raw || /^(?:blob|javascript|vbscript):/i.test(raw)) return "";
  if (/^data:image\//i.test(raw)) return raw;
  if (asset.base64 && raw === asset.base64) return `data:image/png;base64,${raw.replace(/\s+/g, "")}`;
  const uri = getAssetUrl(raw);
  const version = assetId(asset) || raw;
  return `${uri}${uri.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
};

const matchesAssetUrl = (asset: QuestionAsset, source: string): boolean => {
  if (!source) return false;
  if (asset.base64 === source) return true;
  const rawAssetUrl = String(asset.url || "").trim();
  return rawAssetUrl === source || getAssetUrl(rawAssetUrl) === getAssetUrl(source);
};

const decodeEntities = (value: string): string => value
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));

const plainText = (value: string): string => decodeEntities(value
  .replace(/<br\s*\/?\s*>/gi, "\n")
  .replace(/<\/(?:p|div|li|h[1-6]|blockquote)\s*>/gi, "\n")
  .replace(/<[^>]*>/g, "")
  .replace(/[\t ]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n"));

const readImageSource = (tag: string): string => {
  const match = tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return String(match?.[1] || match?.[2] || match?.[3] || "").trim();
};

const buildParts = (value: string, assets: QuestionAsset[]): ContentPart[] => {
  const available = assets.filter((asset) => assetUri(asset));
  const rendered = new Set<QuestionAsset>();
  const parts: ContentPart[] = [];
  const tokens = /\[image:([^\]\s]+)\]|<img\b[^>]*>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = tokens.exec(value)) !== null) {
    const text = plainText(value.slice(cursor, match.index)).trim();
    if (text) parts.push({ type: "text", key: `text-${index++}`, value: text });

    const isMarker = match[1] !== undefined;
    const source = isMarker ? "" : readImageSource(match[0]);
    const asset = isMarker
      ? available.find((candidate) => assetId(candidate) === String(match?.[1] || "").trim())
        || available.find((candidate) => !rendered.has(candidate))
      : available.find((candidate) => matchesAssetUrl(candidate, source))
        || (source ? { type: "image", usage: "statement", url: source } as QuestionAsset : undefined);

    if (asset) {
      rendered.add(asset);
      parts.push({ type: "image", key: `image-${assetId(asset) || index}`, asset });
      index += 1;
    }
    // Um marcador sem asset correspondente não deve aparecer como texto técnico.
    cursor = tokens.lastIndex;
  }

  const remainder = plainText(value.slice(cursor)).trim();
  if (remainder) parts.push({ type: "text", key: `text-${index++}`, value: remainder });

  available
    .filter((asset) => !rendered.has(asset))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach((asset) => parts.push({ type: "image", key: `image-${assetId(asset) || index++}`, asset }));

  return parts;
};

export function QuestionRichContent({ value, assets = [], textStyle }: { value?: string | null; assets?: QuestionAsset[]; textStyle?: StyleProp<TextStyle> }) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const parts = React.useMemo(() => buildParts(String(value || ""), assets), [assets, value]);

  if (!parts.length) return null;
  return <View style={styles.content}>
    {parts.map((part) => part.type === "text"
      ? <Text key={part.key} style={[styles.text, textStyle]}>{part.value}</Text>
      : <QuestionImage key={part.key} asset={part.asset} styles={styles} />)}
  </View>;
}

function QuestionImage({ asset, styles }: { asset: QuestionAsset; styles: ReturnType<typeof createStyles> }) {
  const [aspectRatio, setAspectRatio] = React.useState(1.5);
  const [failed, setFailed] = React.useState(false);
  const uri = assetUri(asset);
  if (!uri || failed) return <Text style={styles.imageError}>{asset.alt || "Não foi possível carregar a imagem."}</Text>;
  return <View style={styles.imageFrame}>
    <Image
      accessibilityLabel={asset.alt || "Imagem da questão"}
      onError={() => setFailed(true)}
      onLoad={({ nativeEvent }) => {
        const { width, height } = nativeEvent.source;
        if (width > 0 && height > 0) setAspectRatio(width / height);
      }}
      resizeMode="contain"
      source={{ uri }}
      style={[styles.image, { aspectRatio }]}
    />
    {asset.caption ? <Text style={styles.caption}>{asset.caption}</Text> : null}
  </View>;
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  content: { gap: spacing[1], width: "100%" },
  text: { color: theme.text, fontSize: typography.size.sm, lineHeight: 22 },
  imageFrame: { alignItems: "center", backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", padding: spacing[2], width: "100%" },
  image: { maxHeight: 360, width: "100%" },
  caption: { color: theme.textMuted, fontSize: typography.size.xs, marginTop: spacing[2], textAlign: "center" },
  imageError: { color: theme.textSubtle, fontSize: typography.size.xs, fontStyle: "italic" },
});

export default QuestionRichContent;
