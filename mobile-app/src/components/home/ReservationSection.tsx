import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { StaticAssets } from "../../constants/assets";
import { useApp } from "../../providers/AppProvider";
import { post } from "../../lib/api";

const TIMES = [
  "11:00 am", "11:30 am",
  "12:00 pm", "12:30 pm",
  "1:00 pm",  "1:30 pm",
  "2:00 pm",  "2:30 pm",
  "3:00 pm",  "3:30 pm",
  "4:00 pm",  "4:30 pm",
  "5:00 pm",  "5:30 pm",
  "6:00 pm",  "6:30 pm",
  "7:00 pm",  "7:30 pm",
  "8:00 pm",  "8:30 pm",
  "9:00 pm",  "9:30 pm",
  "10:00 pm",
];

const PERSONS = [
  "1 Person",  "2 Persons", "3 Persons", "4 Persons",
  "5 Persons", "6 Persons", "7 Persons", "8 Persons",
  "9 Persons", "10 Persons", "10+ Persons",
];

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateToDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

export function ReservationSection() {
  const { user } = useApp();
  const router = useRouter();

  const [date, setDate] = useState(getTodayString());
  const [time, setTime] = useState("7:00 pm");
  const [persons, setPersons] = useState("2 Persons");

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [personsModalVisible, setPersonsModalVisible] = useState(false);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [booked, setBooked] = useState(false);

  // Calendar State
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  // Animations
  const leafARotation = useSharedValue(0);
  const leafBRotation = useSharedValue(150);

  useEffect(() => {
    leafARotation.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 5000, easing: Easing.inOut(Easing.quad) }),
        withTiming(-5, { duration: 5000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );

    leafBRotation.value = withRepeat(
      withSequence(
        withTiming(160, { duration: 5500, easing: Easing.inOut(Easing.quad) }),
        withTiming(140, { duration: 5500, easing: Easing.inOut(Easing.quad) }),
        withTiming(150, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);

  const animatedLeafA = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leafARotation.value}deg` }],
  }));

  const animatedLeafB = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leafBRotation.value}deg` }],
  }));

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleBooking = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    if (!date) {
      showToast("Please select a reservation date.", "error");
      return;
    }

    const selectedDateObj = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);

    if (selectedDateObj < today) {
      showToast("Reservations cannot be in the past.", "error");
      return;
    }

    if (selectedDateObj > maxDate) {
      showToast("Reservations can only be made up to 2 years in advance.", "error");
      return;
    }

    setBusy(true);
    try {
      const response = await post<{ success?: boolean; error?: string }>("/api/reservations", {
        date,
        time,
        persons,
      });

      if (response.error) {
        showToast(response.error, "error");
      } else {
        setBooked(true);
      }
    } catch (e: any) {
      showToast(e?.message ?? "Something went wrong. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleMonthChange = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const calendarDays = [];

    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<View key={`empty-${i}`} style={styles.calendarDayCell} />);
    }

    const maxDateLimit = new Date();
    maxDateLimit.setFullYear(maxDateLimit.getFullYear() + 2);

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = date === dayStr;
      
      const dayDate = new Date(currentYear, currentMonth, day);
      const isPast = dayDate < new Date(new Date().setHours(0,0,0,0));
      const isTooFar = dayDate > maxDateLimit;
      const isDisabled = isPast || isTooFar;

      calendarDays.push(
        <Pressable
          key={`day-${day}`}
          disabled={isDisabled}
          style={[
            styles.calendarDayCell,
            isSelected && styles.calendarSelectedDay,
            isDisabled && styles.calendarDisabledDay,
          ]}
          onPress={() => {
            setDate(dayStr);
            setBooked(false);
            setDateModalVisible(false);
          }}
        >
          <Text
            style={[
              styles.calendarDayText,
              isSelected && styles.calendarSelectedDayText,
              isDisabled && styles.calendarDisabledDayText,
            ]}
          >
            {day}
          </Text>
        </Pressable>
      );
    }

    return calendarDays;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <View style={styles.container}>
      {/* ── Excellent Cook Section ── */}
      <View style={styles.banner}>
        {/* Leaf top */}
        <Animated.Image
          source={StaticAssets.leafA}
          style={[styles.leafTop, animatedLeafA]}
          resizeMode="contain"
        />

        <View style={styles.cookFlex}>
          <View style={styles.chefSide}>
            <Animated.Image
              source={StaticAssets.chef}
              style={styles.chefStaticImg}
              resizeMode="contain"
            />
          </View>
          <View style={styles.cookContent}>
            <Text style={styles.excellentTitle}>
              Excellent{"\n"}cook
            </Text>
            <Text style={styles.excellentDesc}>
              Our expert chefs bring passion and precision to every dish, carefully selecting the finest ingredients and crafting each recipe with dedication. From preparation to presentation,...
            </Text>
          </View>
        </View>

        {/* Leaf bottom */}
        <Animated.Image
          source={StaticAssets.leafB}
          style={[styles.leafBottom, animatedLeafB]}
          resizeMode="contain"
        />
      </View>

      {/* ── Reservation Section (Form) ── */}
      <View style={styles.reservationSection}>
        <Text style={styles.resMainTitle}>Make a Reservation</Text>
        <Text style={styles.resSubText}>Get in touch with restaurant</Text>

        <View style={styles.resFormGrid}>
          {/* Date Selector Trigger Box */}
          <Pressable
            style={styles.resInputBox}
            onPress={() => setDateModalVisible(true)}
          >
            <View style={styles.inputWrapper}>
              <Text style={styles.resInputText} numberOfLines={1}>
                {formatDateToDisplay(date)}
              </Text>
              <Ionicons name="calendar-outline" size={14} color="#666" style={styles.calendarIcon} />
            </View>
            <Ionicons name="chevron-down" size={12} color="#888" />
          </Pressable>

          {/* Time Selector Trigger Box */}
          <Pressable
            style={styles.resInputBox}
            onPress={() => setTimeModalVisible(true)}
          >
            <Text style={styles.resInputText} numberOfLines={1}>
              {time}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#888" />
          </Pressable>

          {/* Guest Selector Trigger Box */}
          <Pressable
            style={styles.resInputBox}
            onPress={() => setPersonsModalVisible(true)}
          >
            <Text style={styles.resInputText} numberOfLines={1}>
              {persons}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#888" />
          </Pressable>
        </View>

        <View style={styles.resBtnWrapper}>
          {booked ? (
            <View style={styles.bookedContainer}>
              <View style={[styles.resSubmitBtn, styles.resSubmitBtnBooked]}>
                <Text style={styles.resSubmitBtnText}>BOOKED ✓</Text>
              </View>
              <Pressable
                style={styles.resCallBtn}
                onPress={() => Linking.openURL("tel:+918690987272")}
              >
                <Ionicons name="call" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleBooking}
              disabled={busy}
              style={[styles.resSubmitBtn, busy && styles.resSubmitBtnDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.resSubmitBtnText}>BOOK NOW</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Date Picker Modal ── */}
      <Modal
        visible={dateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => handleMonthChange("prev")}>
                <Ionicons name="chevron-back" size={24} color="#111" />
              </Pressable>
              <Text style={styles.calendarHeaderTitle}>
                {monthNames[currentMonth]} {currentYear}
              </Text>
              <Pressable onPress={() => handleMonthChange("next")}>
                <Ionicons name="chevron-forward" size={24} color="#111" />
              </Pressable>
            </View>

            <View style={styles.weekLabelsRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                <Text key={day} style={styles.weekLabelText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {renderCalendar()}
            </View>

            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setDateModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Time Slots Modal ── */}
      <Modal
        visible={timeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.selectionCard}>
            <Text style={styles.selectionTitle}>Select Time Slot</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={styles.selectorGrid}>
                {TIMES.map(t => {
                  const isSelected = time === t;
                  return (
                    <Pressable
                      key={t}
                      style={[styles.selectorItem, isSelected && styles.selectorItemSelected]}
                      onPress={() => {
                        setTime(t);
                        setBooked(false);
                        setTimeModalVisible(false);
                      }}
                    >
                      <Text style={[styles.selectorItemText, isSelected && styles.selectorItemSelectedText]}>
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setTimeModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Guest Count Modal ── */}
      <Modal
        visible={personsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPersonsModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.selectionCard}>
            <Text style={styles.selectionTitle}>Number of Guests</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={styles.selectorGrid}>
                {PERSONS.map(p => {
                  const isSelected = persons === p;
                  return (
                    <Pressable
                      key={p}
                      style={[styles.selectorItem, isSelected && styles.selectorItemSelected]}
                      onPress={() => {
                        setPersons(p);
                        setBooked(false);
                        setPersonsModalVisible(false);
                      }}
                    >
                      <Text style={[styles.selectorItemText, isSelected && styles.selectorItemSelectedText]}>
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setPersonsModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Custom Toast ── */}
      {toast && (
        <View
          style={[
            styles.toastContainer,
            toast.type === "success" ? styles.toastSuccess : styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>
            {toast.type === "success" ? "✓ " : "⚠ "}{toast.msg}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#fff9f4",
  },

  /* ── Chef Banner Styles ── */
  banner: {
    backgroundColor: "#e66a0d",
    position: "relative",
    paddingTop: 40,
    paddingBottom: 0,
    width: "100%",
    overflow: "hidden",
  },
  cookFlex: {
    flexDirection: "row",
    alignItems: "flex-end",
    width: "100%",
  },
  chefSide: {
    width: "45%",
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  chefStaticImg: {
    width: "110%",
    height: 180,
    marginLeft: -10,
    marginBottom: -22,
  },
  cookContent: {
    width: "55%",
    paddingLeft: 8,
    paddingRight: 16,
    paddingBottom: 35,
  },
  excellentTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    lineHeight: 36,
    color: "#ffffff",
    fontWeight: "700",
    marginBottom: 10,
  },
  excellentDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    lineHeight: 14,
    color: "#ffffff",
    opacity: 0.95,
  },
  leafTop: {
    position: "absolute",
    top: 15,
    left: "5%",
    width: 60,
    height: 60,
    opacity: 0.25,
    tintColor: "#ffffff",
  },
  leafBottom: {
    position: "absolute",
    bottom: 20,
    right: "5%",
    width: 60,
    height: 60,
    opacity: 0.25,
    tintColor: "#ffffff",
  },

  /* ── Reservation Form Styles ── */
  reservationSection: {
    backgroundColor: "#fff9f4",
    paddingVertical: 50,
    paddingHorizontal: 16,
    width: "100%",
    alignItems: "center",
  },
  resMainTitle: {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontSize: 38,
    color: "#222222",
    marginBottom: 8,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 8,
    transform: [{ perspective: 1000 }, { rotateX: "25deg" }],
  },
  resSubText: {
    fontFamily: "Poppins_400Regular",
    color: "#666666",
    fontSize: 14,
    marginBottom: 35,
    textAlign: "center",
  },
  resFormGrid: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
    marginBottom: 30,
  },
  resInputBox: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#d5c9bf",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  resInputText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#333333",
    flex: 1,
  },
  calendarIcon: {
    marginRight: 6,
  },
  resBtnWrapper: {
    width: "100%",
    alignItems: "center",
  },
  resSubmitBtn: {
    backgroundColor: "#1b2607",
    width: "100%",
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    elevation: 3,
    shadowColor: "#1b2607",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  resSubmitBtnDisabled: {
    opacity: 0.65,
  },
  bookedContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  resSubmitBtnBooked: {
    flex: 1,
    backgroundColor: "#15803d", // Green success theme
    shadowColor: "#15803d",
  },
  resCallBtn: {
    width: 54,
    height: 54,
    backgroundColor: "#e66a0d", // Restaurant theme orange
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#e66a0d",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  resSubmitBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
    letterSpacing: 1.5,
  },

  /* ── Selection Modals ── */
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  selectionCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    elevation: 10,
  },
  selectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: "#111111",
    textAlign: "center",
    marginBottom: 16,
  },
  selectorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingBottom: 10,
  },
  selectorItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5d9cf",
    borderRadius: 6,
    backgroundColor: "#fff9f4",
  },
  selectorItemSelected: {
    backgroundColor: "#e66a0d",
    borderColor: "#e66a0d",
  },
  selectorItemText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#21150f",
  },
  selectorItemSelectedText: {
    color: "#ffffff",
    fontFamily: "Poppins_600SemiBold",
  },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3ece6",
  },
  modalCloseText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: "#756860",
  },

  /* ── Calendar Picker Styles ── */
  calendarCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarHeaderTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: "#111111",
  },
  weekLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekLabelText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: "#a19288",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calendarDayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginVertical: 2,
  },
  calendarSelectedDay: {
    backgroundColor: "#e66a0d",
  },
  calendarDisabledDay: {
    opacity: 0.18,
  },
  calendarDayText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#111111",
  },
  calendarSelectedDayText: {
    color: "#ffffff",
    fontFamily: "Poppins_600SemiBold",
  },
  calendarDisabledDayText: {
    color: "#999",
  },

  /* ── Toast Container ── */
  toastContainer: {
    position: "absolute",
    bottom: 40,
    left: "10%",
    right: "10%",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    zIndex: 9999,
  },
  toastSuccess: {
    backgroundColor: "#15803d",
  },
  toastError: {
    backgroundColor: "#dc2626",
  },
  toastText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 18,
  },
});
