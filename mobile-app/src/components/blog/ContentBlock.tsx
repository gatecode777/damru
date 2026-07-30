import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import type { ContentBlock } from '../../hooks/useBlogDetail';
import { resolveBlogImage } from '../../hooks/useBlogDetail';

const { width: SW } = Dimensions.get('window');
const CONTENT_WIDTH = SW - 40; // 20px padding each side

/* ─────────────────────────────────────────────────────────────
   Individual block renderers
───────────────────────────────────────────────────────────── */

function BlockParagraph({ text }: { text: string }) {
  return <Text style={s.paragraph}>{text}</Text>;
}

function BlockHeading({ text }: { text: string }) {
  /* .sb-main h2: Playfair Display 24px (mobile), color #000, margin 30 0 16 */
  return <Text style={s.heading}>{text}</Text>;
}

function BlockSubheading({ text }: { text: string }) {
  /* .sb-main h3: Playfair Display 18px (mobile), color #000, margin 20 0 12 */
  return <Text style={s.subheading}>{text}</Text>;
}

function BlockQuote({ text }: { text: string }) {
  /* .sb-main__quote: Poppins italic 18px, color #7a9c1e, margin 40 0 */
  return (
    <View style={s.quoteWrapper}>
      <View style={s.quoteBorder} />
      <Text style={s.quoteText}>"{text}"</Text>
    </View>
  );
}

function BlockCallout({ text }: { text: string }) {
  /* callout: bg #fff7ed, border #fed7aa, border-radius 10, color #92400e */
  return (
    <View style={s.calloutWrapper}>
      <Text style={s.calloutText}>💡 {text}</Text>
    </View>
  );
}

function BlockBulletList({ items }: { items: string[] }) {
  /* .sb-main__list: margin 16 0 20 20, each li margin-bottom 10 */
  return (
    <View style={s.listWrapper}>
      {items.filter(Boolean).map((item, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bullet}>•</Text>
          <Text style={s.listItem}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function BlockNumberedList({ items }: { items: string[] }) {
  return (
    <View style={s.listWrapper}>
      {items.filter(Boolean).map((item, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bullet}>{i + 1}.</Text>
          <Text style={s.listItem}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function BlockImage({
  imageFile,
  imageAlt,
  imageCaption,
}: {
  imageFile: string;
  imageAlt?: string;
  imageCaption?: string;
}) {
  /* figure: margin 20 0; img: width 100%, border-radius 10 */
  const uri = resolveBlogImage(imageFile);
  return (
    <View style={s.imageBlock}>
      <Image
        source={{ uri }}
        style={s.inlineImage}
        resizeMode="cover"
        accessibilityLabel={imageAlt ?? ''}
      />
      {imageCaption ? (
        <Text style={s.imageCaption}>{imageCaption}</Text>
      ) : null}
    </View>
  );
}

function BlockTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  /* .sb-main__table: th bg #2d8a01 white, td bg #ccff99 */
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={s.tableScroll}>
      <View>
        {/* Header row */}
        <View style={s.tableRow}>
          {headers.map((h, i) => (
            <View key={i} style={s.tableHeader}>
              <Text style={s.tableHeaderText}>{h}</Text>
            </View>
          ))}
        </View>
        {/* Data rows */}
        {rows.map((row, ri) => (
          <View key={ri} style={s.tableRow}>
            {row.map((cell, ci) => (
              <View key={ci} style={s.tableCell}>
                <Text style={s.tableCellText}>{cell}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function BlockDivider() {
  /* hr: border-top 1px solid #e5e7eb, margin 24 0 */
  return <View style={s.divider} />;
}

/* ─────────────────────────────────────────────────────────────
   Main exported renderer — switches on block.type
───────────────────────────────────────────────────────────── */
export function ContentBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <BlockParagraph text={block.text ?? ''} />;
    case 'heading':
      return <BlockHeading text={block.text ?? ''} />;
    case 'subheading':
      return <BlockSubheading text={block.text ?? ''} />;
    case 'quote':
      return <BlockQuote text={block.text ?? ''} />;
    case 'callout':
      return <BlockCallout text={block.text ?? ''} />;
    case 'bullet_list':
      return <BlockBulletList items={block.items ?? []} />;
    case 'numbered_list':
      return <BlockNumberedList items={block.items ?? []} />;
    case 'image':
      return block.imageFile ? (
        <BlockImage
          imageFile={block.imageFile}
          imageAlt={block.imageAlt}
          imageCaption={block.imageCaption}
        />
      ) : null;
    case 'table':
      return block.tableHeaders?.length ? (
        <BlockTable headers={block.tableHeaders} rows={block.tableRows ?? []} />
      ) : null;
    case 'divider':
      return <BlockDivider />;
    default:
      return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Styles — direct CSS-to-RN mapping from blogdetails.css
───────────────────────────────────────────────────────────── */
const CELL_W = 120;

const s = StyleSheet.create({
  /*
   * .sb-main p equivalent (no explicit class):
   * Poppins 15px, #444, line-height 1.6, margin-bottom 16px
   */
  paragraph: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: '#444444',
    lineHeight: 24,
    marginBottom: 16,
  },

  /*
   * .sb-main h2 (mobile): Playfair Display 24px, #000
   * margin: 30 0 16
   */
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#000000',
    marginTop: 30,
    marginBottom: 16,
    lineHeight: 30,
  },

  /*
   * .sb-main h3 (mobile): Playfair Display 18px, #000
   * margin: 20 0 12
   */
  subheading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: '#000000',
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 24,
  },

  /*
   * .sb-main__quote (mobile):
   * Poppins italic 18px, color #7a9c1e, font-weight 500, margin 40 0
   * + left accent border (not in CSS but enhances native readability)
   */
  quoteWrapper: {
    flexDirection: 'row',
    marginVertical: 40,
    gap: 12,
  },
  quoteBorder: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#7a9c1e',
  },
  quoteText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontStyle: 'italic',
    fontSize: 18,
    color: '#7a9c1e',
    fontWeight: '500',
    lineHeight: 28,
  },

  /*
   * callout: bg #fff7ed, border 1.5px solid #fed7aa, border-radius 10
   * padding 14 18, font Poppins 13.5px, color #92400e, margin 16 0
   */
  calloutWrapper: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginVertical: 16,
  },
  calloutText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13.5,
    color: '#92400e',
    lineHeight: 21,
  },

  /*
   * .sb-main__list: margin 16 0 20 20
   * li: margin-bottom 10
   */
  listWrapper: {
    marginTop: 16,
    marginBottom: 20,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  bullet: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
    width: 18,
  },
  listItem: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },

  /*
   * figure: margin 20 0
   * img: width 100%, border-radius 10
   * figcaption: text-align center, font-size 12px, color #9ca3af, margin-top 6
   */
  imageBlock: {
    marginVertical: 20,
  },
  inlineImage: {
    width: CONTENT_WIDTH,
    height: CONTENT_WIDTH * 0.6,
    borderRadius: 10,
  },
  imageCaption: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    fontFamily: 'Poppins_400Regular',
  },

  /*
   * .sb-main__table: font-size 15px, margin 30 0
   * th: bg #2d8a01, white, padding 15
   * td: bg #ccff99, padding 15, border 1px solid #fff
   */
  tableScroll: {
    marginVertical: 30,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeader: {
    width: CELL_W,
    backgroundColor: '#2d8a01',
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#fff',
  },
  tableHeaderText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#ffffff',
  },
  tableCell: {
    width: CELL_W,
    backgroundColor: '#ccff99',
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#ffffff',
  },
  tableCellText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#222',
  },

  /*
   * hr: border-top 1px solid #e5e7eb, margin 24 0
   */
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
});
