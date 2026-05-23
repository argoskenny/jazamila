import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getMeetUser, loginMeetUser, registerMeetUser, updateMeetProfile } from "@/lib/domain/meet";

function suffix(): string {
  return crypto.randomBytes(4).toString("hex");
}

describe("meet domain", () => {
  it("registers, logs in, and updates a profile", async () => {
    const id = suffix();
    const user = await registerMeetUser({
      account: `user${id}`,
      password: "secret123",
      password_confirmation: "secret123",
      email: `user${id}@example.com`
    });

    expect(user.id).toBeGreaterThan(0);

    const loggedIn = await loginMeetUser({
      account: `user${id}`,
      password: "secret123"
    });

    expect(loggedIn?.id).toBe(user.id);

    const updated = await updateMeetProfile(user.id, {
      name: "Updated User",
      email: `updated${id}@example.com`,
      description: "Hello Meet"
    });

    expect(updated.name).toBe("Updated User");
    expect(updated.description).toBe("Hello Meet");
  });

  it("upgrades legacy md5 passwords after successful login", async () => {
    const id = suffix();
    const legacyPassword = crypto.createHash("md5").update("legacy123").digest("hex");
    const legacy = await prisma.user.create({
      data: {
        account: `legacy${id}`,
        password: legacyPassword,
        email: `legacy${id}@example.com`
      }
    });

    const loggedIn = await loginMeetUser({
      account: `legacy${id}`,
      password: "legacy123"
    });

    expect(loggedIn?.id).toBe(legacy.id);

    const upgraded = await getMeetUser(legacy.id);
    const raw = await prisma.user.findUniqueOrThrow({ where: { id: legacy.id } });

    expect(upgraded?.account).toBe(`legacy${id}`);
    expect(raw.password).not.toBe(legacyPassword);
    expect(raw.password.startsWith("$2")).toBe(true);
  });
});
