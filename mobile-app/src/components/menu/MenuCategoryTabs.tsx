import React, { useRef, useEffect } from "react";
import {
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { colors } from "../../config";

interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
}

interface MenuCategoryTabsProps {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const MenuCategoryTabs = React.memo(function MenuCategoryTabs({
  categories,
  activeId,
  onSelect,
}: MenuCategoryTabsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<{ [key: string]: { x: number; width: number } }>({});

  useEffect(() => {
    if (activeId && layouts.current[activeId]) {
      const { x, width } = layouts.current[activeId];
      scrollRef.current?.scrollTo({
        x: Math.max(0, x - 100), // center the item roughly
        animated: true,
      });
    }
  }, [activeId]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((cat) => {
          const isActive = cat._id === activeId;
          return (
            <Pressable
              key={cat._id}
              style={[styles.chip, isActive && styles.chipActive]}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                layouts.current[cat._id] = { x, width };
              }}
              onPress={() => onSelect(cat._id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={cat.name}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f2ede8",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  chipTextActive: {
    fontFamily: "Poppins_600SemiBold",
    color: "#ffffff",
  },
});
