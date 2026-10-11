// app/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function setAssetRating(id: string, rating: number) {
  await prisma.asset.update({
    where: { id },
    data: { rating },
  });
  revalidatePath("/");
}

export async function batchSetRating(ids: string[], rating: number) {
  await prisma.asset.updateMany({
    where: { id: { in: ids } },
    data: { rating },
  });
  revalidatePath("/");
}

export async function setAssetPersona(id: string, persona: string) {
  await prisma.asset.update({
    where: { id },
    data: { persona },
  });
  revalidatePath("/");
}

export async function batchSetPersona(ids: string[], persona: string) {
  await prisma.asset.updateMany({
    where: { id: { in: ids } },
    data: { persona },
  });
  revalidatePath("/");
}

export async function toggleArchiveAsset(id: string, isArchived: boolean) {
  await prisma.asset.update({
    where: { id },
    data: { isArchived },
  });
  revalidatePath("/");
}

export async function batchArchiveAssets(ids: string[], isArchived: boolean) {
  await prisma.asset.updateMany({
    where: { id: { in: ids } },
    data: { isArchived },
  });
  revalidatePath("/");
}

export async function updateAssetPrompt(id: string, promptText: string) {
  await prisma.asset.update({
    where: { id },
    data: { promptText },
  });
  revalidatePath("/");
}

export async function deleteAsset(id: string) {
  await prisma.asset.delete({
    where: { id },
  });
  revalidatePath("/");
}
