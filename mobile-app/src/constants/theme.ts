export const Colors = {
  primaryOrange: '#e67e22',
  primaryOrangeDark: '#a85218',
  textBrown: '#764208',
  darkText: '#111111',
  borderGray: '#e0e0e0',
  brand: '#e67e22',
  brandDark: '#a85218',
  brandLight: '#fff7ed',
  brandMid: '#fed7aa',
  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#f9fafb',
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  text: '#111111',
  text2: '#764208',
  text3: '#9ca3af',
  white: '#ffffff',
  black: '#000000',
  star: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
};

export const Typography = {
  h1: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36, color: Colors.darkText },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28, color: Colors.darkText },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, color: Colors.darkText },
  subheading: { fontSize: 14, fontWeight: '600' as const, color: Colors.textBrown, letterSpacing: 1.0 },
  heroHeading: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36, color: Colors.darkText },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, color: Colors.darkText },
  bodyBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, color: Colors.darkText },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, color: Colors.text3 },
  btnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.white, letterSpacing: 0.5 },
};

export const Layout = {
  radius: 12,
  radiusSm: 8,
  radiusFull: 999,
  paddingHorizontal: 16,
  paddingVertical: 12,
};
