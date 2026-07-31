import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { HomeHeader } from '../../components/home/HomeHeader';
import { HeroSection } from '../../components/home/HeroSection';
import { MenuSection } from '../../components/home/MenuSection';
import { DietPlanningSection } from '../../components/home/DietPlanningSection';
import { BanquetShowcaseSection } from '../../components/home/BanquetShowcaseSection';
import { BranchesSection } from '../../components/home/BranchesSection';
import { IndoChineseSection } from '../../components/home/IndoChineseSection';
import { QualityHighlightsSection } from '../../components/home/QualityHighlightsSection';
import { BlogsSection } from '../../components/home/BlogsSection';
import { ReservationSection } from '../../components/home/ReservationSection';
import { TasteThroughLensSection } from '../../components/home/TasteThroughLensSection';
import { Colors } from '../../constants/theme';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <HomeHeader />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. HERO SECTION ── */}
        <HeroSection />

        {/* ── 2. DIET PLANNING SECTION ── */}
        <DietPlanningSection />

        {/* ── 3. MENU SHOWCASE SECTION ── */}
        <MenuSection />

        {/* ── 4. BANQUET SHOWCASE SLIDER ── */}
        <BanquetShowcaseSection />

        {/* ── 6. OUR BRANCHES SECTION ── */}
        <BranchesSection />

        {/* ── 7. INDO CHINESE SECTION ── */}
        <IndoChineseSection />

        {/* ── 8. QUALITY HIGHLIGHTS SECTION ── */}
        <QualityHighlightsSection />

        {/* ── 9. OUR BLOGS SECTION ── */}
        <BlogsSection />

        {/* ── 10. RESERVATION SECTION ── */}
        <ReservationSection />

        {/* ── 11. TASTE THROUGH LENS SECTION ── */}
        <TasteThroughLensSection />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    paddingBottom: 75,
  },
});
