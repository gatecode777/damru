import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Menu", href: "/menu" },
  { label: "Banquet / Events", href: "/branches" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "Offers", href: "/offers" },
];

const SERVICE_LINKS = [
  { label: "Online Order", href: "/menu" },
  { label: "Birthday Parties", href: "/branches" },
  { label: "Wedding Functions", href: "/branches" },
  { label: "Corporate Events", href: "/branches" },
  { label: "Catering Services", href: "/contact-us" },
  { label: "Dine-In", href: "/menu" },
  { label: "Blogs", href: "/blogs" },
];

const POLICY_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Booking Policy", href: "/booking-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];

const SOCIAL_LINKS = [
  { icon: "instagram", url: "https://instagram.com" },
  { icon: "twitter", url: "https://twitter.com" },
  { icon: "facebook", url: "https://facebook.com" },
  { icon: "youtube-play", url: "https://youtube.com" },
];

export function AppFooter() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleLinkPress = (href: string) => {
    if (href === "/") {
      router.push("/");
    } else if (href === "/menu") {
      router.push("/menu");
    } else if (href === "/branches") {
      router.push("/branches");
    } else if (href === "/gallery") {
      router.push("/gallery");
    } else if (href === "/blogs") {
      router.push("/blogs");
    } else {
      Linking.openURL(`https://damrurestro.com${href}`);
    }
  };

  const handleSubscribe = () => {
    if (!email.trim() || !email.includes("@")) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => {
      setSubscribed(false);
    }, 4000);
  };

  const currentYear = new Date().getFullYear();

  return (
    <View style={styles.footer}>
      {/* ── Main Container ── */}
      <View style={styles.container}>
        
        {/* Intro Section */}
        <View style={styles.sectionCol}>
          <Text style={styles.introText}>
            We serve delicious food with a perfect ambiance and offer premium
            banquet services for weddings, birthdays, and special occasions.
          </Text>
          <View style={styles.socialIconsRow}>
            {SOCIAL_LINKS.map((item) => (
              <Pressable
                key={item.icon}
                style={styles.socialCircle}
                onPress={() => Linking.openURL(item.url)}
              >
                <FontAwesome name={item.icon as any} size={18} color="#ffffff" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quick Links Group */}
        <View style={styles.sectionCol}>
          <Text style={styles.groupTitle}>Quick Links</Text>
          <View style={styles.linksGrid}>
            {QUICK_LINKS.map((link) => (
              <Pressable
                key={link.label}
                style={styles.linkItem}
                onPress={() => handleLinkPress(link.href)}
              >
                <Text style={styles.linkText}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Service Links Group */}
        <View style={styles.sectionCol}>
          <Text style={styles.groupTitle}>Our Services</Text>
          <View style={styles.linksGrid}>
            {SERVICE_LINKS.map((link) => (
              <Pressable
                key={link.label}
                style={styles.linkItem}
                onPress={() => handleLinkPress(link.href)}
              >
                <Text style={styles.linkText}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Policy Links Group */}
        <View style={styles.sectionCol}>
          <Text style={styles.groupTitle}>Policies</Text>
          <View style={styles.linksGrid}>
            {POLICY_LINKS.map((link) => (
              <Pressable
                key={link.label}
                style={styles.linkItem}
                onPress={() => handleLinkPress(link.href)}
              >
                <Text style={styles.linkText}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Newsletter Section */}
        <View style={styles.sectionCol}>
          <Text style={styles.groupTitle}>Newsletter</Text>
          <View style={styles.newsletterForm}>
            <TextInput
              style={styles.emailInput}
              placeholder="Your email address"
              placeholderTextColor="#888888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[
                styles.subscribeBtn,
                subscribed && styles.subscribeBtnActive,
              ]}
              onPress={handleSubscribe}
            >
              <Text style={styles.subscribeBtnText}>
                {subscribed ? "✓ Subscribed!" : "Subscribe"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.newsletterNote}>
            Join our subscribers and get the best recipes and offers delivered each week!
          </Text>
        </View>

      </View>

      {/* ── Disclaimer & Copyright Bar (Last Div) ── */}
      <View style={styles.disclaimerBar}>
        <Text style={styles.disclaimerText}>
          All information on this website is for general purposes only. Prices,
          menu, and services may change without notice. We are not liable for any
          inaccuracies or unforeseen issues. Please contact us for the latest details.
        </Text>
        <View style={styles.separator} />
        <Text style={styles.copyrightText}>
          © {currentYear} damru. All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#1a1a1a", // Website footer background color
    width: "100%",
    paddingTop: 50,
  },
  container: {
    paddingHorizontal: 20,
    gap: 35,
    paddingBottom: 40,
  },
  sectionCol: {
    width: "100%",
    alignItems: "center", // Center elements in columns
  },
  introText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: "#cccccc",
    textAlign: "center", // Center introductory paragraph text
    marginBottom: 20,
  },
  socialIconsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center", // Center social icons row
  },
  socialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#222222",
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 6,
    width: "100%",
    textAlign: "center", // Center headings
  },
  linksGrid: {
    gap: 12,
    alignItems: "center", // Center-align vertical grids
  },
  linkItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  linkText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#ffffff",
    textAlign: "center", // Center text alignment
  },
  newsletterForm: {
    flexDirection: "row",
    width: "100%",
    height: 48,
    marginBottom: 12,
  },
  emailInput: {
    flex: 1.3,
    height: "100%",
    borderWidth: 1,
    borderColor: "#555555",
    backgroundColor: "transparent",
    paddingHorizontal: 15,
    color: "#ffffff",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  subscribeBtn: {
    flex: 1,
    height: "100%",
    backgroundColor: "#e66a0d", // Restaurant theme orange
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  subscribeBtnActive: {
    backgroundColor: "#28a745", // Green success indicator on active subscribe
  },
  subscribeBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "600",
  },
  newsletterNote: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#aaaaaa",
    textAlign: "center", // Center note
  },
  disclaimerBar: {
    backgroundColor: "#e66a0d", // Disclaimer background orange
    paddingTop: 24,
    paddingBottom: 110, // Tall bottom padding to ensure no text is hidden behind the floating navigation bar
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#ffffff",
    textAlign: "center",
  },
  separator: {
    width: "50%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginVertical: 14,
  },
  copyrightText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#ffffff", // Copyright text styled as white
    textAlign: "center",
  },
});
