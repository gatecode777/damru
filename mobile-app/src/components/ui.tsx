import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { colors } from "@/config";

export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <View style={styles.titleWrap}>
    {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

export function Button({ label, loading, variant = "primary", style, ...props }: PressableProps & {
  label: string; loading?: boolean; variant?: "primary" | "outline" | "ghost";
}) {
  const resolvedStyle = style as StyleProp<ViewStyle>;
  return <Pressable accessibilityRole="button" disabled={loading || props.disabled}
    style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, resolvedStyle]} {...props}>
    {loading ? <ActivityIndicator color={variant === "primary" ? "#fff" : colors.orange} /> :
      <Text style={[styles.buttonText, variant !== "primary" && styles.buttonTextAlt]}>{label}</Text>}
  </Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label?: string; error?: string }) {
  return <View style={styles.fieldWrap}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput placeholderTextColor="#a89b93" style={[styles.field, !!error && styles.fieldError]} {...props} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>🍽️</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.subtitle}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  titleWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  button: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primary: { backgroundColor: colors.orange },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.orange },
  ghost: { backgroundColor: colors.cream },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  buttonTextAlt: { color: colors.orangeDark },
  fieldWrap: { gap: 6, marginBottom: 14 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  field: { minHeight: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", borderRadius: 13, paddingHorizontal: 15, color: colors.ink, fontSize: 15 },
  fieldError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12 },
  empty: { margin: 20, padding: 28, backgroundColor: colors.cream, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: colors.line },
  emptyIcon: { fontSize: 38, marginBottom: 12 },
  emptyTitle: { fontSize: 18, color: colors.ink, fontWeight: "800" },
});
