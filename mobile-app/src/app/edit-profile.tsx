import React, { useState } from "react";
import { View, StyleSheet, Text, ScrollView, Pressable, Image as RNImage, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "@/providers/AppProvider";
import { patch } from "@/lib/api";
import { colors, assetUrl, avatarUrl, API_URL } from "@/config";
import { Button, Field } from "@/components/ui";
import { Image } from "@/components/ui/Image";

function uploadFileViaXHR(uri: string, filename: string, type: string): Promise<{ filename: string; url: string }> {
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
      } catch (err) {
        reject(new Error("Failed to parse server response."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network request failed."));
    };

    const fd = new FormData();
    fd.append("file", {
      uri,
      name: filename,
      type,
    } as any);
    fd.append("target", "avatar");

    xhr.send(fd);
  });
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useApp();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");

  // Avatar states
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [avatarDeleted, setAvatarDeleted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need library permissions to select photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
        setAvatarDeleted(false);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to open library.");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "We need camera permissions to take photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
        setAvatarDeleted(false);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to open camera.");
    }
  };

  const removePhoto = () => {
    setSelectedImageUri(null);
    setAvatarDeleted(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    let finalAvatar = user?.avatar || "";

    if (selectedImageUri) {
      try {
        const filename = selectedImageUri.split("/").pop() || "avatar.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        const uploadRes = await uploadFileViaXHR(selectedImageUri, filename, type);
        if (uploadRes.filename) {
          finalAvatar = uploadRes.filename;
        }
      } catch (err: any) {
        setError(err?.message || "Failed to upload profile image.");
        setSaving(false);
        return;
      }
    } else if (avatarDeleted) {
      finalAvatar = "";
    }

    try {
      const response = await patch<{ success: boolean; user: any }>("/api/user/me", {
        action: "updateProfile",
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        avatar: finalAvatar,
      });

      if (response.success && response.user) {
        setUser({
          ...user!,
          name: response.user.name,
          phone: response.user.phone,
          city: response.user.city,
          avatar: response.user.avatar,
        });
        setSuccess("Profile updated successfully!");
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Edit Profile", headerShown: true }} />

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {success ? (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      {/* Avatar Edit Area */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          {selectedImageUri ? (
            <RNImage source={{ uri: selectedImageUri }} style={styles.avatarImage} />
          ) : !avatarDeleted && user?.avatar ? (
            <Image source={avatarUrl(user.avatar)} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {user?.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.avatarActions}>
          <Pressable style={styles.avatarActionBtn} onPress={pickImage}>
            <Text style={styles.avatarActionText}>Upload Photo</Text>
          </Pressable>
          <Pressable style={styles.avatarActionBtn} onPress={takePhoto}>
            <Text style={styles.avatarActionText}>Take Photo</Text>
          </Pressable>
          {(user?.avatar && !avatarDeleted) || selectedImageUri ? (
            <Pressable style={[styles.avatarActionBtn, styles.removeBtn]} onPress={removePhoto}>
              <Text style={[styles.avatarActionText, styles.removeText]}>Remove Photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Field
        label="Full Name"
        value={name}
        onChangeText={setName}
        placeholder="Enter your full name"
        autoCapitalize="words"
      />

      <Field
        label="Phone Number"
        value={phone}
        onChangeText={setPhone}
        placeholder="Enter 10-digit phone number"
        keyboardType="phone-pad"
      />

      <Field
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="Enter your city"
        autoCapitalize="words"
      />

      <View style={styles.btnWrapper}>
        <Button
          label={saving ? "Saving..." : "Save Profile"}
          onPress={handleSave}
          disabled={saving}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  btnWrapper: {
    marginTop: 20,
  },
  errorCard: {
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef9a9a",
    marginBottom: 8,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.danger,
  },
  successCard: {
    backgroundColor: "#e8f5e9",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a5d6a7",
    marginBottom: 8,
  },
  successText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.green,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
    gap: 16,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderWidth: 2,
    borderColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange,
  },
  avatarPlaceholderText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 36,
    color: "#ffffff",
  },
  avatarActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  avatarActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee3da",
    backgroundColor: "#ffffff",
  },
  avatarActionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#756860",
  },
  removeBtn: {
    borderColor: "rgba(192, 57, 43, 0.2)",
    backgroundColor: "rgba(192, 57, 43, 0.02)",
  },
  removeText: {
    color: colors.danger,
  },
});
