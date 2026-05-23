import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Feedback } from "@/lib/domain/types";
import { feedbackSchema } from "@/lib/validation/forms";

type PrismaFeedback = Prisma.FeedbackGetPayload<object>;

function fromPrismaFeedback(feedback: PrismaFeedback): Feedback {
  return {
    id: Number(feedback.id),
    f_name: feedback.name ?? "",
    f_email: feedback.email ?? "",
    f_content: feedback.content ?? "",
    f_time: Number(feedback.timeUnix),
    f_isread: feedback.isRead
  };
}

export async function createFeedback(input: unknown): Promise<Feedback> {
  const data = feedbackSchema.parse(input);
  const feedback = await prisma.feedback.create({
    data: {
      name: data.name,
      email: data.email,
      content: data.content,
      timeUnix: Math.floor(Date.now() / 1000),
      isRead: 0
    }
  });
  return fromPrismaFeedback(feedback);
}

export async function listFeedbackForAdmin(): Promise<Feedback[]> {
  const feedback = await prisma.feedback.findMany({
    orderBy: { id: "desc" }
  });
  return feedback.map(fromPrismaFeedback);
}

export async function markFeedbackRead(id: number): Promise<Feedback | null> {
  try {
    const feedback = await prisma.feedback.update({
      where: { id },
      data: { isRead: 1 }
    });
    return fromPrismaFeedback(feedback);
  } catch {
    return null;
  }
}
