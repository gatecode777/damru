import React from 'react';
import { Image as ExpoImage, ImageProps as ExpoImageProps, ImageContentFit } from 'expo-image';
import { ImageResizeMode, StyleProp, ImageStyle } from 'react-native';

export type ImageProps = Omit<ExpoImageProps, 'contentFit' | 'source'> & {
  source: any;
  contentFit?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  resizeMode?: ImageResizeMode;
  style?: StyleProp<ImageStyle>;
};

export const Image: React.FC<ImageProps> = ({
  contentFit,
  resizeMode,
  style,
  source,
  ...props
}) => {
  // Map resizeMode/contentFit to ExpoImage's contentFit
  const mode = resizeMode || contentFit;
  let resolvedContentFit: ImageContentFit = 'cover';
  if (mode === 'contain') resolvedContentFit = 'contain';
  else if (mode === 'stretch') resolvedContentFit = 'fill';
  else if (mode === 'center') resolvedContentFit = 'none';

  let resolvedSource = source;
  if (source && typeof source === 'object' && 'uri' in source) {
    const uriVal = (source as any).uri;
    if (typeof uriVal === 'string') {
      resolvedSource = { uri: uriVal };
    } else {
      resolvedSource = uriVal;
    }
  } else if (typeof source === 'string') {
    resolvedSource = { uri: source };
  }

  if (!resolvedSource) {
    return null;
  }

  return (
    <ExpoImage
      source={resolvedSource}
      contentFit={resolvedContentFit}
      style={style as any}
      transition={150} // 150ms fade-in transition
      cachePolicy="memory-disk" // Memory-disk cache for robust caching
      placeholder="#f5efe9" // Neutral cream theme placeholder to prevent flashing white box
      {...props}
    />
  );
};
