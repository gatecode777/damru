import React from 'react';
import {
  Image as RNImage,
  ImageProps as RNImageProps,
  ImageResizeMode,
} from 'react-native';

export interface ImageProps extends Omit<RNImageProps, 'resizeMode' | 'source'> {
  source: any;
  contentFit?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  resizeMode?: ImageResizeMode;
}

export const Image: React.FC<ImageProps> = ({
  contentFit,
  resizeMode,
  style,
  source,
  ...props
}) => {
  const resolvedResizeMode: ImageResizeMode =
    resizeMode ||
    (contentFit === 'contain'
      ? 'contain'
      : contentFit === 'stretch'
      ? 'stretch'
      : contentFit === 'center'
      ? 'center'
      : contentFit === 'repeat'
      ? 'repeat'
      : 'cover');

  let resolvedSource = source;
  if (source && typeof source === 'object' && 'uri' in source) {
    const uriVal = (source as any).uri;
    if (
      typeof uriVal === 'number' ||
      (typeof uriVal === 'object' && uriVal !== null && !('startsWith' in uriVal))
    ) {
      resolvedSource = uriVal;
    } else if (typeof uriVal === 'string') {
      resolvedSource = { uri: uriVal };
    }
  } else if (typeof source === 'string') {
    resolvedSource = { uri: source };
  }

  if (!resolvedSource) {
    return null;
  }

  return (
    <RNImage
      source={resolvedSource}
      resizeMode={resolvedResizeMode}
      style={style}
      {...props}
    />
  );
};
