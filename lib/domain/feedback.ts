import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Feedback } from "@/lib/domain/types";
import { clampPage } from "@/lib/pagination";
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

export async function listFeedbackForAdmin({ page = 1, perPage = 50 } = {}) {
  const take = Math.min(Math.max(1, perPage), 100);
  const totalRows = await prisma.feedback.count();
  const totalPages = Math.max(1, Math.ceil(totalRows / take));
  const currentPage = clampPage(page, totalPages);
  const feedback = await prisma.feedback.findMany({
    orderBy: { id: "desc" },
    skip: (currentPage - 1) * take,
    take
  });
  return {
    feedback: feedback.map(fromPrismaFeedback),
    totalRows,
    totalPages,
    page: currentPage,
    perPage: take
  };
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
