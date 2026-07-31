import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';

/* ─────────────────────────────────────────────
   Static feature data — exact text and icons
   from app/(website)/page.tsx (hardcoded array,
   no API or database involvement).
   Icons are Flaticon CDN PNGs, same as website.
───────────────────────────────────────────── */
const FEATURES = [
  {
    key: 'premium-quality',
    icon: 'https://cdn-icons-png.flaticon.com/512/2927/2927347.png',
    title: 'Premium Quality',
    desc: 'We use only the finest ingredients to deliver rich taste and top-notch quality in every bite.',
  },
  {
    key: 'seasonal-vegetables',
    icon: 'https://cdn-icons-png.flaticon.com/512/2329/2329895.png',
    title: 'Seasonal Vegetables',
    desc: 'Fresh, locally sourced seasonal vegetables for natural taste and maximum nutrition.',
  },
  {
    key: 'fresh-fruit',
    icon: 'https://cdn-icons-png.flaticon.com/512/3194/3194591.png',
    title: 'Fresh Fruit',
    desc: 'Handpicked fresh fruits to ensure purity, sweetness, and refreshing flavor every time.',
  },
] as const;

const { width: SCREEN_W } = Dimensions.get('window');

/* ─────────────────────────────────────────────
   Single feature item — mirrors .feature-item
───────────────────────────────────────────── */
function FeatureItem({
  icon,
  title,
  desc,
  isLast,
}: {
  icon: string;
  title: string;
  desc: string;
  isLast: boolean;
}) {
  return (
    <View style={[styles.item, isLast && styles.itemLast]}>
      {/* .feature-icon-circle: 80×80, bg #f1f3e8, icon 40×40 */}
      <View style={styles.iconCircle}>
        <Image
          source={{ uri: icon }}
          style={styles.iconImage}
          resizeMode="contain"
          accessibilityLabel={title}
        />
      </View>

      {/* .feature-item h3: Playfair Display, 24px, #000, mb 10 */}
      <Text style={styles.title}>{title}</Text>

      {/* .feature-item p: Montserrat, ~15px, #666, lh 1.6, maxW 280 */}
      <Text style={styles.desc}>{desc}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Section export
───────────────────────────────────────────── */
export function QualityHighlightsSection() {
  return (
    <View style={styles.section}>
      {FEATURES.map((f, i) => (
        <FeatureItem
          key={f.key}
          icon={f.icon}
          title={f.title}
          desc={f.desc}
          isLast={i === FEATURES.length - 1}
        />
      ))}
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles — direct mapping from style.css
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  /*
   * .special-feature-section
   *   padding: 80px 5% (desktop) → 40px 5% (mobile ≤480px)
   *   background-color: #fff
   */
  section: {
    backgroundColor: '#ffffff',
    paddingVertical: 48,                          // mobile: 40px → 48 for breathing room
    paddingHorizontal: Math.round(SCREEN_W * 0.05), // 5% horizontal
  },

  /*
   * .feature-item
   *   text-align: center
   *   gap between items (mobile): 40px
   */
  item: {
    alignItems: 'center',
    marginBottom: 40,   // gap: 40px between features
  },
  itemLast: {
    marginBottom: 0,    // no gap after last item
  },

  /*
   * .feature-icon-circle
   *   width: 80px, height: 80px
   *   border-radius: 50%
   *   background-color: #f1f3e8
   *   margin: 0 auto 20px
   */
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f3e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  /*
   * .feature-icon-circle img
   *   width: 40px, height: 40px
   */
  iconImage: {
    width: 40,
    height: 40,
  },

  /*
   * .feature-item h3
   *   font-family: "Playfair Display", serif
   *   font-size: 1.5rem = 24px
   *   font-weight: 700 (h3 default bold)
   *   margin-bottom: 10px
   *   text-align: center
   *   color: #000 (default)
   */
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 30,
  },

  /*
   * .feature-item p
   *   font-size: 0.95rem ≈ 15px
   *   line-height: 1.6 → ~24px
   *   color: #666
   *   max-width: 280px (desktop), 100% (mobile ≤768px)
   *   margin: 0 auto
   *   text-align: center
   */
  desc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#666666',
    textAlign: 'center',
    maxWidth: Math.min(280, SCREEN_W * 0.80), // 280px desktop, 80% on small screens
  },
});
