"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin/dashboard",
    });
  } catch (error: any) {
    // In Next.js, redirects are thrown as intentional errors. We must re-throw them so Next.js can redirect.
    if (
      error &&
      (error.message === "NEXT_REDIRECT" ||
        (typeof error === "object" &&
          "digest" in error &&
          typeof error.digest === "string" &&
          error.digest.startsWith("NEXT_REDIRECT")))
    ) {
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
