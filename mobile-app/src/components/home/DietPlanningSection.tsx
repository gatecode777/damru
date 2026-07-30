import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FoodCategoryCard, FoodCategory } from '../ui/FoodCategoryCard';
import { LocalAssets } from '../../constants/assets';

/* ─────────────────────────────────────────
   Food Categories — exact from website
────────────────────────────────────────── */
const SOUP_CATEGORY: FoodCategory = {
  id: 'sweet-corn-soup',
  name: 'Sweet Corn Soup',
  slug: 'sweet-corn-soup',
  description: 'Fresh • Creamy • Healthy',
  image: LocalAssets.dietPlan1,
  icon: LocalAssets.soup,
  chefImage: LocalAssets.chef,
  chefPosition: 'right',
  targetRoute: '/menu',
  height: 220, // default height
};

const DRINK_CATEGORY: FoodCategory = {
  id: 'tropical-sunrise',
  name: 'Tropical Sunrise',
  slug: 'tropical-sunrise',
  description: 'Fresh • Fruity • Refreshing',
  image: LocalAssets.dietPlan2,
  icon: LocalAssets.drink,
  chefImage: LocalAssets.chef2,
  chefPosition: 'left',
  targetRoute: '/menu',
  height: 320, // larger height for full glass product view
};

export function DietPlanningSection() {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const handleBackgroundPress = () => {
    setActiveCardId(null);
  };

  const handleCardToggle = (id: string) => {
    setActiveCardId((prev) => (prev === id ? null : id));
  };

  return (
    <Pressable onPress={handleBackgroundPress} style={styles.sectionContainer}>
      {/* 1. Text Heading */}
      <Text style={styles.mainHeading}>
        Start to plan{'\n'}your diet today
      </Text>

      {/* 2. Subheading */}
      <Text style={styles.introParagraph}>
        Explore our delicious range of pure vegetarian dishes, crafted with fresh ingredients and authentic flavors for every taste.
      </Text>

      {/* 3. First Image Section (Soup) */}
      <FoodCategoryCard
        category={SOUP_CATEGORY}
        isRevealed={activeCardId === SOUP_CATEGORY.id}
        onToggle={() => handleCardToggle(SOUP_CATEGORY.id)}
      />

      {/* 4. Content (Description) */}
      <Text style={styles.bottomParagraph}>
        Indulge in a variety of delicious dishes, refreshing mocktails, and signature drinks designed to make every meal special.
      </Text>

      {/* 5. Second Image Section (Drink) */}
      <FoodCategoryCard
        category={DRINK_CATEGORY}
        isRevealed={activeCardId === DRINK_CATEGORY.id}
        onToggle={() => handleCardToggle(DRINK_CATEGORY.id)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    width: '100%',
    backgroundColor: '#e37213', // Exact website CSS color
    paddingVertical: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 40, // Matches website CSS clamp margin
  },
  mainHeading: {
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    fontSize: 34,
    lineHeight: 40,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 14,
  },
  introParagraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: '96%',
    opacity: 0.95,
    fontFamily: 'Poppins_400Regular',
  },
  bottomParagraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 24, // spacing between Card 1 and Card 2
    maxWidth: '96%',
    opacity: 0.95,
    fontFamily: 'Poppins_400Regular',
  },
});
