import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MeetUser } from "@/lib/domain/types";
import { meetLoginSchema, meetProfileSchema, meetRegisterSchema } from "@/lib/validation/forms";

type PrismaUser = Prisma.UserGetPayload<object>;

function toMeetUser(user: PrismaUser): MeetUser {
  return {
    id: user.id,
    account: user.account,
    email: user.email,
    name: user.name ?? "",
    description: user.description ?? "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

function isLegacyMd5(hash: string): boolean {
  return /^[a-f0-9]{32}$/.test(hash);
}

export async function registerMeetUser(input: unknown): Promise<MeetUser> {
  const data = meetRegisterSchema.parse(input);
  const password = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      account: data.account,
      password,
      email: data.email
    }
  });
  return toMeetUser(user);
}

export async function loginMeetUser(input: unknown): Promise<MeetUser | null> {
  const data = meetLoginSchema.parse(input);
  const user = await prisma.user.findUnique({
    where: { account: data.account }
  });

  if (!user) return null;

  if (isLegacyMd5(user.password)) {
    if (md5(data.password) !== user.password) return null;
    const password = await bcrypt.hash(data.password, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password }
    });
    return toMeetUser(updated);
  }

  const ok = await bcrypt.compare(data.password, user.password);
  if (!ok) return null;

  const needsRehash = bcrypt.getRounds(user.password) < 12;
  if (needsRehash) {
    const password = await bcrypt.hash(data.password, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password }
    });
    return toMeetUser(updated);
  }

  return toMeetUser(user);
}

export async function getMeetUser(id: number): Promise<MeetUser | null> {
  const user = await prisma.user.findUnique({
    where: { id }
  });
  return user ? toMeetUser(user) : null;
}

export async function updateMeetProfile(id: number, input: unknown): Promise<MeetUser> {
  const data = meetProfileSchema.parse(input);
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      description: data.description
    }
  });
  return toMeetUser(user);
}

export async function listMeetMembers(): Promise<MeetUser[]> {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" }
  });
  return users.map(toMeetUser);
}
