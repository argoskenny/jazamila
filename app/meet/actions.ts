"use server";

import { redirect } from "next/navigation";
import { clearMeetSession, setMeetSession } from "@/lib/auth/meet";
import { loginMeetUser, registerMeetUser, updateMeetProfile } from "@/lib/domain/meet";

function queryError(message: string): string {
  return encodeURIComponent(message);
}

export async function registerMeetAction(formData: FormData) {
  try {
    const user = await registerMeetUser(Object.fromEntries(formData.entries()));
    await setMeetSession(user.id);
  } catch {
    redirect(`/meet/register?error=${queryError("註冊失敗，帳號或 Email 可能已被使用。")}`);
  }

  redirect("/meet/profile");
}

export async function loginMeetAction(formData: FormData) {
  const user = await loginMeetUser(Object.fromEntries(formData.entries()));
  if (!user) {
    redirect(`/meet/login?error=${queryError("帳號或密碼不正確。")}`);
  }

  await setMeetSession(user.id);
  redirect("/meet/profile");
}

export async function logoutMeetAction() {
  await clearMeetSession();
  redirect("/meet/login");
}

export async function updateMeetProfileAction(formData: FormData) {
  const id = Number.parseInt(String(formData.get("id") ?? "0"), 10);
  try {
    await updateMeetProfile(id, Object.fromEntries(formData.entries()));
  } catch {
    redirect(`/meet/profile?error=${queryError("資料更新失敗，請確認 Email 格式。")}`);
  }

  redirect("/meet/profile?saved=1");
}
