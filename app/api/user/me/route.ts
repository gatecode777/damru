import { after, NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, signUserSession } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/models/User";
import bcrypt from "bcryptjs";
import { checkAndAwardDailyLogin } from "@/lib/rewardEngine";
import { evaluateStreakAchievements, evaluateProfileAchievement, evaluateAccountAgeAchievements } from "@/lib/achievementEngine";
import { evaluateStreakMissions, evaluateProfileMission } from "@/lib/missionEngine";

// ── GET /api/user/me ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  // Return fresh data from DB
  try {
    await connectDB();
    const dbUser = await UserModel.findById(user.id)
      .select("name email phone city avatar createdAt")
      .lean() as any;
    if (!dbUser) return NextResponse.json({ user: null }, { status: 401 });

    // Reward maintenance must not delay session restoration or Profile paint.
    // `after` keeps the existing idempotent reward flow authoritative while
    // allowing the user response to be sent as soon as the lightweight lookup finishes.
    after(async () => {
      try {
        const streakResult = await checkAndAwardDailyLogin(user.id);
        if ("currentStreak" in streakResult) {
          await Promise.all([
            evaluateStreakAchievements(user.id, streakResult.currentStreak),
            evaluateStreakMissions(user.id, streakResult.currentStreak),
          ]);
        }
      } catch (err) {
        console.error("checkAndAwardDailyLogin failed:", err);
      }

      try {
        await evaluateAccountAgeAchievements(user.id, dbUser.createdAt);
      } catch (err) {
        console.error("evaluateAccountAgeAchievements failed:", err);
      }
    });

    return NextResponse.json({
      user: {
        id:        String(dbUser._id),
        name:      dbUser.name,
        email:     dbUser.email,
        phone:     dbUser.phone || "",
        city:      dbUser.city  || "",
        avatar:    dbUser.avatar || "",
        createdAt: dbUser.createdAt,
      }
    });
  } catch {
    // Fallback to cookie data
    return NextResponse.json({ user });
  }
}

// ── PATCH /api/user/me — update profile info ─────────────────
export async function PATCH(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    await connectDB();

    if (action === "updateProfile") {
      const { name, phone, city, avatar } = body;
      if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

      const updates: Record<string, string> = { name: name.trim() };
      if (phone !== undefined) {
        if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
          return NextResponse.json({ error: "Please enter a valid 10-digit phone number." }, { status: 400 });
        }
        updates.phone = phone.trim();
      }
      if (city  !== undefined) updates.city  = city.trim();
      if (avatar !== undefined) updates.avatar = avatar;

      const updated = await UserModel.findByIdAndUpdate(
        sessionUser.id, updates, { new: true }
      ).select("name email phone city avatar").lean() as any;

      try {
        await evaluateProfileAchievement(sessionUser.id);
        await evaluateProfileMission(sessionUser.id);
      } catch (err) {
        console.error("evaluateProfileAchievement failed:", err);
      }

      // Re-issue cookie with updated name/avatar
      const jsonRes = NextResponse.json({
        success: true,
        user: { name: updated.name, phone: updated.phone || "", city: updated.city || "", avatar: updated.avatar || "" }
      });
      // Re-issue JWT cookie with updated user info
      signUserSession(jsonRes, {
        id:     String(updated._id),
        name:   updated.name,
        email:  updated.email,
        avatar: updated.avatar || "",
      });
      return jsonRes;
    }

    if (action === "updateDateOfBirth") {
      const { dateOfBirth } = body;
      const dbUser = await UserModel.findById(sessionUser.id).select("dobLocked").lean() as any;
      if (dbUser.dobLocked) return NextResponse.json({ error: "Date of birth is locked. Contact support to change it." }, { status: 403 });

      const parsed = new Date(dateOfBirth);
      if (!dateOfBirth || isNaN(parsed.getTime()) || parsed > new Date()) {
        return NextResponse.json({ error: "Please enter a valid date of birth." }, { status: 400 });
      }

      await UserModel.findByIdAndUpdate(sessionUser.id, { dateOfBirth: parsed, dobLocked: true });
      return NextResponse.json({ success: true });
    }

    if (action === "updateMarriageAnniversary") {
      const { marriageAnniversary } = body;
      const dbUser = await UserModel.findById(sessionUser.id).select("anniversaryLocked").lean() as any;
      if (dbUser.anniversaryLocked) return NextResponse.json({ error: "Anniversary date is locked. Contact support to change it." }, { status: 403 });

      const parsed = new Date(marriageAnniversary);
      if (!marriageAnniversary || isNaN(parsed.getTime()) || parsed > new Date()) {
        return NextResponse.json({ error: "Please enter a valid anniversary date." }, { status: 400 });
      }

      await UserModel.findByIdAndUpdate(sessionUser.id, { marriageAnniversary: parsed, anniversaryLocked: true });
      return NextResponse.json({ success: true });
    }

    if (action === "changePassword") {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) return NextResponse.json({ error: "All fields required." }, { status: 400 });
      if (newPassword.length < 6) return NextResponse.json({ error: "Min 6 characters." }, { status: 400 });

      const dbUser = await UserModel.findById(sessionUser.id).select("password").lean() as any;
      const match = await bcrypt.compare(currentPassword, dbUser.password);
      if (!match) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 10);
      await UserModel.findByIdAndUpdate(sessionUser.id, { password: hashed });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/user/me error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
