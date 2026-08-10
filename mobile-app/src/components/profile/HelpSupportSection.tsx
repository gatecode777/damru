import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image as RNImage,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, assetUrl, API_URL } from "@/config";
import { get, post } from "@/lib/api";
import { Button, Field } from "@/components/ui";
import { AnimatedIcon } from "../ui/AnimatedIcon";
import type { Complaint } from "@/types";

const FAQ_DATA = [
  { cat: "orders", label: "Orders", items: [
    ["How can I track my order status?", "You can track your order in the My Orders section. Click on your order to view real-time status."],
    ["How can I place an order?", "Browse the menu, add items to your cart, proceed to checkout, select your address and payment method, and confirm your order."],
    ["Can I cancel my order?", "Yes, you can cancel your order before preparation begins. Go to My Orders and click Cancel Order."],
    ["Can I modify my order after placing it?", "No, once the order is placed items cannot be modified. You may cancel and place a new order."],
    ["What if my order is delayed?", "If your order is delayed, you can track it in real time or contact support for assistance."],
    ["What should I do if I receive the wrong items?", "Please report the issue in Help & Support. Our team will resolve it promptly."],
    ["Can I reorder the same items?", "Yes, you can use the Reorder option in My Orders section to quickly place the same order again."],
  ]},
  { cat: "payments", label: "Payments", items: [
    ["What payment methods are accepted?", "We accept Credit Cards, Debit Cards, UPI, Net Banking, Wallets, and Cash on Delivery (COD)."],
    ["Is UPI payment safe?", "Yes, all UPI transactions are fully encrypted and secured."],
    ["Why did my payment fail?", "Payment may fail due to: poor internet connection, incorrect card details, insufficient balance, or bank server issues."],
    ["My order was deducted but order failed. What should I do?", "Don't worry. The deducted amount will be automatically refunded within 5–7 business days."],
    ["Can I change my payment method after placing an order?", "No, once the order is placed the payment method cannot be changed."],
  ]},
  { cat: "delivery", label: "Delivery", items: [
    ["How long does delivery take?", "Delivery usually takes 30–60 minutes, depending on the restaurant, traffic, and order volume."],
    ["How do I track my delivery?", "You can track a delivery in real time from the My Orders section after placing your order."],
    ["What are delivery charges?", "Delivery charges may vary based on location and order amount. They will be shown at checkout."],
    ["Do you deliver to my location?", "Enter your address at checkout to see if delivery is available in your area."],
    ["What if I miss my delivery?", "The delivery partner may try for a few minutes. If missed, the order may be cancelled and refunded."],
    ["Can I change my delivery address after placing an order?", "No, once the order is placed the delivery address cannot be changed."],
  ]},
  { cat: "account", label: "Account", items: [
    ["How do I create an account?", "Click Sign Up, enter your name, email, phone, and password to complete registration."],
    ["I forgot my password. What should I do?", "Click Forgot Password on the login page, enter your email and follow instructions to reset your password."],
    ["How can I change my password?", "Go to Account Settings > Change Password, enter your current and new password then save."],
    ["How do I update my profile details?", "Go to My Profile, click Edit Profile, update your details, and click Save."],
    ["How do I delete my account?", "Go to Account Settings > Delete Account and confirm your request."],
    ["Is my personal data secure?", "Yes, your data is securely protected. We do not share it with third parties without consent."],
  ]},
  { cat: "offers", label: "Offers", items: [
    ["How do I apply a coupon code?", "At checkout, enter the code in the Apply Coupon field and press Apply to get the discount."],
    ["Why is my coupon code not working?", "Your coupon may not work due to: expired validity, minimum order value not met, or first-time user only offer."],
    ["Can I use multiple coupons per order?", "No, only one coupon can be applied per order."],
    ["Where can I find available offers?", "Check the Offers & Coupons section in your profile or use the cart page."],
    ["What is the minimum order value for coupons?", "Each coupon has its own minimum order requirement mentioned in its description."],
  ]},
];

interface HelpSupportSectionProps {
  showToast: (msg: string) => void;
}

export function HelpSupportSection({ showToast }: HelpSupportSectionProps) {
  const [helpView, setHelpView] = useState<"home" | "faq" | "complaint">("home");
  const [activeTab, setActiveTab] = useState<"form" | "mycomplaints">("form");

  // FAQ state
  const [faqCat, setFaqCat] = useState("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Complaint form state
  const [issueType, setIssueType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Complaint list state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [expandedComplaint, setExpandedComplaint] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const data = await get<{ complaints: Complaint[] }>("/api/complaints");
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error("Failed to load complaints:", err);
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "mycomplaints" && helpView === "complaint") {
      loadComplaints();
    }
  }, [activeTab, helpView, loadComplaints]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need library permissions to select attachment.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Failed to select image.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need camera permissions to take photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Failed to take photo.");
    }
  };

  const uploadFileViaXHR = (uri: string, filename: string, type: string): Promise<{ filename: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/upload`);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.withCredentials = true;

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res.error || "Failed to upload file."));
          }
        } catch {
          reject(new Error("Failed to parse server response."));
        }
      };
      xhr.onerror = () => reject(new Error("Network request failed."));

      const fd = new FormData();
      fd.append("file", { uri, name: filename, type } as any);
      fd.append("target", "complaints");
      xhr.send(fd);
    });
  };

  const handleSubmitComplaint = async () => {
    if (!issueType) {
      showToast("Please select an issue type!");
      return;
    }
    if (!subject.trim()) {
      showToast("Please enter a subject!");
      return;
    }
    if (!description.trim()) {
      showToast("Please enter a description!");
      return;
    }

    setSubmitting(true);
    let attachment = "";

    if (selectedImageUri) {
      try {
        const filename = selectedImageUri.split("/").pop() || "complaint.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        const res = await uploadFileViaXHR(selectedImageUri, filename, type);
        if (res.filename) {
          attachment = res.filename;
        }
      } catch (err: any) {
        showToast(err?.message || "Failed to upload attachment.");
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await post<{ error?: string }>("/api/complaints", {
        issueType,
        subject: subject.trim(),
        description: description.trim(),
        attachment,
      });

      if (res.error) {
        showToast(res.error);
        return;
      }

      showToast("Complaint submitted successfully! ✅");
      // Reset form
      setIssueType("");
      setSubject("");
      setDescription("");
      setSelectedImageUri(null);
      // Switch tab to list
      setActiveTab("mycomplaints");
    } catch (err: any) {
      showToast(err?.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter visible FAQs
  const visibleFaqs = FAQ_DATA.filter((cat) => faqCat === "all" || cat.cat === faqCat)
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        ([q, a]) =>
          !faqSearch.trim() ||
          q.toLowerCase().includes(faqSearch.toLowerCase()) ||
          a.toLowerCase().includes(faqSearch.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  // FAQ Page View
  if (helpView === "faq") {
    return (
      <View style={styles.subPageContainer}>
        <Pressable style={styles.backLink} onPress={() => setHelpView("home")}>
          <Ionicons name="arrow-back" size={16} color={colors.orange} />
          <Text style={styles.backLinkText}>Back to Help & Support</Text>
        </Pressable>

        <Text style={styles.pageTitle}>Frequently Asked Questions</Text>
        <Text style={styles.pageSubtitle}>Find answers to common questions about orders, payments, and more.</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#a99c94" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search your question"
            value={faqSearch}
            onChangeText={(t: string) => {
              setFaqSearch(t);
              setFaqCat("all");
            }}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
          {["all", "orders", "payments", "delivery", "account", "offers"].map((cat) => (
            <Pressable
              key={cat}
              style={[styles.faqTab, faqCat === cat && styles.faqTabActive]}
              onPress={() => {
                setFaqCat(cat);
                setFaqSearch("");
              }}
            >
              <Text style={[styles.faqTabText, faqCat === cat && styles.faqTabTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ gap: 16 }}>
          {visibleFaqs.map((cat) => (
            <View key={cat.cat} style={styles.faqCategorySection}>
              <Text style={styles.categoryHeader}>❓ {cat.label}</Text>
              <View style={styles.categoryBody}>
                {cat.items.map(([q, a]) => {
                  const isFaqOpen = expandedFaq === q;
                  return (
                    <Pressable
                      key={q}
                      style={styles.faqItem}
                      onPress={() => setExpandedFaq(isFaqOpen ? null : q)}
                    >
                      <View style={styles.faqQuestionRow}>
                        <Text style={styles.faqQuestion}>{q}</Text>
                        <Ionicons
                          name={isFaqOpen ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="#756860"
                        />
                      </View>
                      {isFaqOpen && (
                        <View style={styles.faqAnswerContainer}>
                          <Text style={styles.faqAnswer}>{a}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {visibleFaqs.length === 0 && (
            <Text style={styles.noResultsText}>No results found for "{faqSearch}"</Text>
          )}
        </View>

        {/* Still Need Help Footer Card */}
        <View style={styles.stillHelpCard}>
          <View style={styles.stillHelpHeader}>
            <Ionicons name="help-circle-outline" size={24} color={colors.orange} />
            <View>
              <Text style={styles.stillHelpTitle}>Still Need Help?</Text>
              <Text style={styles.stillHelpDesc}>Can't find the answer you're looking for?</Text>
            </View>
          </View>
          <View style={styles.stillHelpBtns}>
            <Pressable
              style={styles.stillHelpBtnContact}
              onPress={() => showToast("Connecting to support...")}
            >
              <Text style={styles.stillHelpBtnContactText}>Contact Support</Text>
            </Pressable>
            <Pressable
              style={styles.stillHelpBtnComplaint}
              onPress={() => setHelpView("complaint")}
            >
              <Text style={styles.stillHelpBtnComplaintText}>Raise Complaint</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Complaint View
  if (helpView === "complaint") {
    return (
      <View style={styles.subPageContainer}>
        <Pressable style={styles.backLink} onPress={() => setHelpView("home")}>
          <Ionicons name="arrow-back" size={16} color={colors.orange} />
          <Text style={styles.backLinkText}>Back to Help & Support</Text>
        </Pressable>

        {/* Tabs for Form or List */}
        <View style={styles.tabHeader}>
          <Pressable
            style={[styles.tabButton, activeTab === "form" && styles.tabButtonActive]}
            onPress={() => setActiveTab("form")}
          >
            <AnimatedIcon
              name="create-outline"
              size={18}
              color={activeTab === "form" ? colors.orange : "#888"}
              active={activeTab === "form"}
              type="spring"
            />
            <Text style={[styles.tabButtonText, activeTab === "form" && styles.tabButtonTextActive]}>
              Raise Complaint
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === "mycomplaints" && styles.tabButtonActive]}
            onPress={() => setActiveTab("mycomplaints")}
          >
            <AnimatedIcon
              name="list-outline"
              size={18}
              color={activeTab === "mycomplaints" ? colors.orange : "#888"}
              active={activeTab === "mycomplaints"}
              type="spring"
            />
            <Text style={[styles.tabButtonText, activeTab === "mycomplaints" && styles.tabButtonTextActive]}>
              My Complaints
            </Text>
          </Pressable>
        </View>

        {/* Tab: Raise Complaint */}
        {activeTab === "form" && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>📝 Submit a Complaint</Text>

            <Text style={styles.dropdownLabel}>Issue Type</Text>
            <View style={styles.selectWrapper}>
              <Pressable
                style={styles.selectBtn}
                onPress={() => {
                  Alert.alert(
                    "Select Issue Type",
                    "",
                    [
                      { text: "Order Issue", onPress: () => setIssueType("Order Issue") },
                      { text: "Payment Issue", onPress: () => setIssueType("Payment Issue") },
                      { text: "Delivery Issue", onPress: () => setIssueType("Delivery Issue") },
                      { text: "Wrong Items", onPress: () => setIssueType("Wrong Items") },
                      { text: "Missing Items", onPress: () => setIssueType("Missing Items") },
                      { text: "Account Issue", onPress: () => setIssueType("Account Issue") },
                      { text: "Other", onPress: () => setIssueType("Other") },
                      { text: "Cancel", style: "cancel" },
                    ]
                  );
                }}
              >
                <Text style={[styles.selectBtnText, !issueType && styles.selectPlaceholder]}>
                  {issueType || "Select Issue Type"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#756860" />
              </Pressable>
            </View>

            <Field
              label="Subject"
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief subject of your complaint"
            />

            <Text style={styles.dropdownLabel}>Description</Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your issue in detail..."
            />

            <Text style={styles.dropdownLabel}>Attachment (Optional)</Text>
            {selectedImageUri ? (
              <View style={styles.previewContainer}>
                <RNImage source={{ uri: selectedImageUri }} style={styles.previewImage} />
                <Pressable
                  style={styles.previewRemoveBtn}
                  onPress={() => setSelectedImageUri(null)}
                >
                  <Text style={styles.previewRemoveText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.uploadButtonsRow}>
                <Pressable style={styles.uploadBtn} onPress={handlePickImage}>
                  <Ionicons name="images-outline" size={16} color={colors.orange} />
                  <Text style={styles.uploadBtnText}>Upload Photo</Text>
                </Pressable>
                <Pressable style={styles.uploadBtn} onPress={handleTakePhoto}>
                  <Ionicons name="camera-outline" size={16} color={colors.orange} />
                  <Text style={styles.uploadBtnText}>Take Photo</Text>
                </Pressable>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <Button
                label={submitting ? "Submitting..." : "Submit Complaint"}
                onPress={handleSubmitComplaint}
                disabled={submitting}
              />
            </View>
          </View>
        )}

        {/* Tab: My Complaints list */}
        {activeTab === "mycomplaints" && (
          <View style={{ gap: 12 }}>
            {complaintsLoading ? (
              <ActivityIndicator size="small" color={colors.orange} style={{ margin: 20 }} />
            ) : complaints.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={32} color="#a99c94" />
                <Text style={styles.emptyText}>No complaints submitted yet.</Text>
              </View>
            ) : (
              complaints.map((c) => {
                const isExpanded = expandedComplaint === c._id;
                const statusColor =
                  c.status === "resolved"
                    ? "#15803d"
                    : c.status === "in_progress"
                    ? colors.orange
                    : "#c0392b";
                const statusBg =
                  c.status === "resolved"
                    ? "#e8f5e9"
                    : c.status === "in_progress"
                    ? "rgba(229, 121, 34, 0.1)"
                    : "#ffebee";

                return (
                  <View key={c._id} style={styles.listItemCard}>
                    <Pressable
                      style={styles.complaintHeaderRow}
                      onPress={() => setExpandedComplaint(isExpanded ? null : c._id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.complaintSubject}>{c.subject}</Text>
                        <Text style={styles.complaintSubtext}>
                          {c.issueType} · {new Date(c.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.statusBadgeWrapper}>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {c.status.toUpperCase().replace("_", " ")}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="#aaa"
                        />
                      </View>
                    </Pressable>

                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        <Text style={styles.complaintDesc}>{c.description}</Text>
                        {c.attachment ? (
                          <View style={{ marginBottom: 12 }}>
                            <Text style={styles.attachmentLabel}>Attachment:</Text>
                            <RNImage
                              source={{ uri: assetUrl("complaints", c.attachment) }}
                              style={styles.attachmentImage}
                            />
                          </View>
                        ) : null}
                        {c.adminNote ? (
                          <View style={styles.adminNoteBox}>
                            <Text style={styles.adminNoteHeader}>Admin Response:</Text>
                            <Text style={styles.adminNoteText}>{c.adminNote}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
    );
  }

  // Home View
  return (
    <View style={styles.homeContainer}>
      <Text style={styles.sectionTitle}>Help & Support</Text>
      <Text style={styles.sectionSubtitle}>We're here to help you with any issues or questions.</Text>

      {/* Cards Panel */}
      <View style={styles.helpCardsGrid}>
        <View style={styles.helpCard}>
          <AnimatedIcon name="help-circle-outline" size={24} color={colors.orange} type="float" />
          <Text style={styles.cardHeaderTitle}>FAQs</Text>
          <Text style={styles.cardHeaderDesc}>Find answers to frequently asked questions</Text>
          <Pressable style={styles.helpCardBtn} onPress={() => setHelpView("faq")}>
            <Text style={styles.helpCardBtnText}>Browse FAQs</Text>
          </Pressable>
        </View>

        <View style={styles.helpCard}>
          <AnimatedIcon name="call-outline" size={24} color={colors.orange} type="pulse" />
          <Text style={styles.cardHeaderTitle}>Contact Us</Text>
          <Text style={styles.cardHeaderDesc}>Get in touch with our support team</Text>
          <Pressable
            style={styles.helpCardBtn}
            onPress={() => showToast("Our support team will contact you shortly!")}
          >
            <Text style={styles.helpCardBtnText}>Get In Touch</Text>
          </Pressable>
        </View>

        <View style={styles.helpCard}>
          <AnimatedIcon name="create-outline" size={24} color={colors.orange} type="spring" active={true} />
          <Text style={styles.cardHeaderTitle}>Complaints</Text>
          <Text style={styles.cardHeaderDesc}>Report an issue with your order or service</Text>
          <Pressable style={styles.helpCardBtn} onPress={() => setHelpView("complaint")}>
            <Text style={styles.helpCardBtnText}>Report Issue</Text>
          </Pressable>
        </View>
      </View>

      {/* Common FAQ Questions List */}
      <View style={styles.faqListCard}>
        <Text style={styles.faqListHeader}>💡 Common Questions</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          {[
            ["How can I track my order status?", "Go to My Orders section in your profile to view real-time status."],
            ["What is the estimated delivery time?", "30–45 minutes depending on your location and order size."],
            ["How can I apply a coupon code?", "Go to Offers & Coupons section, copy the code and use it at checkout."],
            ["How to cancel an order and request refund?", "Orders can be cancelled before preparation begins. Refunds are processed within 5–7 business days."],
          ].map(([q, a]) => {
            const isFaqOpen = expandedFaq === q;
            return (
              <Pressable
                key={q}
                style={styles.faqListItem}
                onPress={() => setExpandedFaq(isFaqOpen ? null : q)}
              >
                <View style={styles.faqQuestionRow}>
                  <Text style={styles.faqQuestionText}>{q}</Text>
                  <Ionicons
                    name={isFaqOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#756860"
                  />
                </View>
                {isFaqOpen && <Text style={styles.faqAnswerText}>{a}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: colors.ink,
  },
  sectionSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#a99c94",
    marginTop: -8,
    marginBottom: 4,
  },
  helpCardsGrid: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  helpCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee3da",
    gap: 6,
  },
  cardHeaderTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.ink,
    textAlign: "center",
  },
  cardHeaderDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 9.5,
    color: "#a99c94",
    textAlign: "center",
    lineHeight: 13,
    height: 38,
  },
  helpCardBtn: {
    backgroundColor: "rgba(229, 121, 34, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  helpCardBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: colors.orange,
  },
  faqListCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
    marginTop: 10,
  },
  faqListHeader: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: colors.ink,
  },
  faqListItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f9ece2",
    paddingBottom: 10,
  },
  faqQuestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestionText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#5c5048",
    flex: 1,
    marginRight: 8,
  },
  faqAnswerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11.5,
    color: "#a99c94",
    marginTop: 6,
    lineHeight: 16,
  },
  subPageContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  backLinkText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  pageTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: colors.ink,
  },
  pageSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#a99c94",
    marginTop: -8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
  },
  tabScroll: {
    marginVertical: 4,
    height: 38,
  },
  tabScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  faqTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  faqTabActive: {
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderColor: colors.orange,
  },
  faqTabText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#756860",
  },
  faqTabTextActive: {
    color: colors.orange,
    fontWeight: "600",
  },
  faqCategorySection: {
    gap: 8,
  },
  categoryHeader: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13.5,
    color: colors.ink,
    marginTop: 4,
  },
  categoryBody: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
    overflow: "hidden",
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#fcf8f4",
    padding: 14,
  },
  faqQuestion: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#5c5048",
    flex: 1,
    marginRight: 8,
  },
  faqAnswerContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#fcf8f5",
  },
  faqAnswer: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#8d817a",
    lineHeight: 16,
  },
  noResultsText: {
    fontFamily: "Poppins_400Regular",
    color: "#a99c94",
    fontSize: 13,
    textAlign: "center",
    padding: 20,
  },
  stillHelpCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee3da",
    padding: 14,
    gap: 12,
    marginTop: 10,
  },
  stillHelpHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  stillHelpTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13.5,
    color: colors.ink,
  },
  stillHelpDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11.5,
    color: "#a99c94",
  },
  stillHelpBtns: {
    flexDirection: "row",
    gap: 8,
  },
  stillHelpBtnContact: {
    flex: 1,
    backgroundColor: "rgba(229, 121, 34, 0.08)",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  stillHelpBtnContactText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  stillHelpBtnComplaint: {
    flex: 1,
    backgroundColor: colors.orange,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  stillHelpBtnComplaintText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#ffffff",
  },
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee3da",
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: colors.orange,
  },
  tabButtonText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#888",
  },
  tabButtonTextActive: {
    color: colors.orange,
    fontFamily: "Poppins_600SemiBold",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
    gap: 12,
  },
  formTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: colors.ink,
    marginBottom: 4,
  },
  dropdownLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.ink,
    marginBottom: -4,
  },
  selectWrapper: {
    height: 44,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
    borderRadius: 10,
    justifyContent: "center",
  },
  selectBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  selectBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  selectPlaceholder: {
    color: "#a99c94",
  },
  textarea: {
    height: 80,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eee3da",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    textAlignVertical: "top",
    color: colors.ink,
  },
  uploadButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(229, 121, 34, 0.15)",
    backgroundColor: "#ffffff",
  },
  uploadBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  previewContainer: {
    position: "relative",
    width: "100%",
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewRemoveText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  listItemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#a99c94",
    textAlign: "center",
  },
  complaintHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complaintSubject: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 2,
  },
  complaintSubtext: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11.5,
    color: "#a99c94",
  },
  statusBadgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 9.5,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#fcf8f5",
  },
  complaintDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#756860",
    lineHeight: 17,
    marginBottom: 12,
  },
  attachmentLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11.5,
    color: "#a99c94",
    marginBottom: 6,
  },
  attachmentImage: {
    width: "100%",
    maxWidth: 240,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  adminNoteBox: {
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#a5d6a7",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  adminNoteHeader: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#15803d",
    marginBottom: 2,
  },
  adminNoteText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#2e7d32",
    lineHeight: 16,
  },
});
