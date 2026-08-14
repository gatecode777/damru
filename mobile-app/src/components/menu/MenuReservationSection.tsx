import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../providers/AppProvider";
import { post } from "../../lib/api";
import { colors } from "../../config";

const TIMES = [
  "11:00 am", "11:30 am", "12:00 pm", "12:30 pm", "1:00 pm", "1:30 pm",
  "2:00 pm", "2:30 pm", "3:00 pm", "3:30 pm", "4:00 pm", "4:30 pm",
  "5:00 pm", "5:30 pm", "6:00 pm", "6:30 pm", "7:00 pm", "7:30 pm",
  "8:00 pm", "8:30 pm", "9:00 pm", "9:30 pm", "10:00 pm",
];

const PERSONS = [
  "1 Person", "2 Persons", "3 Persons", "4 Persons", "5 Persons",
  "6 Persons", "7 Persons", "8 Persons", "9 Persons", "10 Persons", "10+ Persons",
];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

export function MenuReservationSection() {
  const { user } = useApp();
  const router = useRouter();

  const [date, setDate] = useState(getTodayString());
  const [time, setTime] = useState("7:00 pm");
  const [persons, setPersons] = useState("2 Persons");

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [personsModalVisible, setPersonsModalVisible] = useState(false);

  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState(false);

  // Calendar State
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const showToast = (msg: string, type: "success" | "error") => {
    Alert.alert(type === "success" ? "Success" : "Error", msg);
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
        showToast("Reservation booked successfully!", "success");
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

    // Empty spaces for previous month's tail
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);
    }

    const maxDateLimit = new Date();
    maxDateLimit.setFullYear(maxDateLimit.getFullYear() + 2);

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = date === dayStr;
      const isToday = getTodayString() === dayStr;

      const dayDate = new Date(currentYear, currentMonth, day);
      const isPast = dayDate < new Date(new Date().setHours(0, 0, 0, 0));
      const isTooFar = dayDate > maxDateLimit;
      const isDisabled = isPast || isTooFar;

      calendarDays.push(
        <Pressable
          key={`day-${day}`}
          disabled={isDisabled}
          style={[
            styles.calendarDay,
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
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
              isToday && styles.calendarDayTodayText,
              isSelected && styles.calendarDaySelectedText,
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

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>Make a Reservation</Text>
        <Text style={styles.subtitle}>
          Get in touch with the restaurant to book your evening.
        </Text>

        {/* Form Container */}
        <View style={styles.form}>
          {/* Select Date field */}
          <Text style={styles.label}>Select Date</Text>
          <Pressable onPress={() => setDateModalVisible(true)} style={styles.input}>
            <Text style={styles.inputText}>{formatDateToDisplay(date)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#a99c94" />
          </Pressable>

          {/* Time and Guests fields in a row */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Time</Text>
              <Pressable onPress={() => setTimeModalVisible(true)} style={styles.input}>
                <Text style={styles.inputText}>{time}</Text>
                <Ionicons name="time-outline" size={18} color="#a99c94" />
              </Pressable>
            </View>

            <View style={styles.col}>
              <Text style={styles.label}>Guests</Text>
              <Pressable onPress={() => setPersonsModalVisible(true)} style={styles.input}>
                <Text style={styles.inputText}>{persons}</Text>
                <Ionicons name="people-outline" size={18} color="#a99c94" />
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          {booked ? (
            <View style={styles.bookedRow}>
              <View style={[styles.bookBtn, styles.bookedBtn]}>
                <Text style={styles.bookBtnText}>BOOKED ✓</Text>
              </View>
              <Pressable
                onPress={() => Linking.openURL("tel:+918690987272")}
                style={styles.callBtn}
              >
                <Ionicons name="call" size={20} color="#ffffff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleBooking}
              disabled={busy}
              style={[styles.bookBtn, busy && styles.bookBtnDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.bookBtnText}>BOOK NOW</Text>
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
                <Ionicons name="chevron-back" size={24} color={colors.ink} />
              </Pressable>
              <Text style={styles.calendarHeaderTitle}>
                {monthNames[currentMonth]} {currentYear}
              </Text>
              <Pressable onPress={() => handleMonthChange("next")}>
                <Ionicons name="chevron-forward" size={24} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.weekLabelsRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <Text key={day} style={styles.weekLabelText}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>{renderCalendar()}</View>

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
                {TIMES.map((t) => {
                  const isSelected = time === t;
                  return (
                    <Pressable
                      key={t}
                      style={[
                        styles.selectorItem,
                        isSelected && styles.selectorItemSelected,
                      ]}
                      onPress={() => {
                        setTime(t);
                        setBooked(false);
                        setTimeModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.selectorItemText,
                          isSelected && styles.selectorItemSelectedText,
                        ]}
                      >
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
                {PERSONS.map((p) => {
                  const isSelected = persons === p;
                  return (
                    <Pressable
                      key={p}
                      style={[
                        styles.selectorItem,
                        isSelected && styles.selectorItemSelected,
                      ]}
                      onPress={() => {
                        setPersons(p);
                        setBooked(false);
                        setPersonsModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.selectorItemText,
                          isSelected && styles.selectorItemSelectedText,
                        ]}
                      >
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

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: "#faf9f6",
  },
  card: {
    backgroundColor: "#20272c",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#a99c94",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  form: {
    gap: 14,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#a99c94",
    marginBottom: 4,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
  },
  inputText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#ffffff",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  bookBtn: {
    backgroundColor: colors.orange,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBtnDisabled: {
    opacity: 0.7,
  },
  bookedBtn: {
    flex: 1,
    backgroundColor: "#198754",
    shadowColor: "#198754",
    marginTop: 0,
  },
  bookBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  bookedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  callBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Modals */
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  calendarHeaderTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: colors.ink,
  },
  weekLabelsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekLabelText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: colors.muted,
    width: 36,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    justifyContent: "space-around",
  },
  calendarDay: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    marginVertical: 3,
  },
  calendarDayEmpty: {
    width: 36,
    height: 36,
    marginVertical: 3,
  },
  calendarDayText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: colors.orange,
  },
  calendarDayTodayText: {
    color: colors.orange,
    fontWeight: "600",
  },
  calendarDaySelected: {
    backgroundColor: colors.orange,
  },
  calendarDaySelectedText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  calendarDisabledDay: {
    opacity: 0.3,
  },
  calendarDisabledDayText: {
    color: colors.muted,
  },
  modalCloseBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalCloseText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.orange,
  },

  /* Selection modal for lists */
  selectionCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
  },
  selectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.ink,
    marginBottom: 16,
    textAlign: "center",
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#ffffff",
  },
  selectorItemSelected: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  selectorItemText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
  },
  selectorItemSelectedText: {
    fontFamily: "Poppins_600SemiBold",
    color: "#ffffff",
  },
});
