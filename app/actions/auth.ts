"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin/dashboard",
    });
  } catch (error: any) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("Login action error:", error);

    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password. Please try again." };
        default:
          return { error: `Authentication error: ${error.type} - ${error.message || ""}` };
      }
    }

    // Return the actual database connection error or server error message
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Server/Database connection error: ${message}` };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
