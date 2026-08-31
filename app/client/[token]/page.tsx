import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { shoots } from "../../../db/schema";
import ClientPortal from "../../client-portal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const [project] = await getDb()
      .select({ clientName: shoots.clientName, type: shoots.type })
      .from(shoots)
      .where(eq(shoots.portalToken, token))
      .limit(1);
    const title = project
      ? `${project.type} — ${project.clientName} · PhotoFlow`
      : "Проект клиента · PhotoFlow";
    const description = project
      ? `Дата, памятка и статус проекта «${project.type}».`
      : "Дата, памятка и статус вашего фотопроекта.";
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, images: [] },
      twitter: { title, description, images: [] },
    };
  } catch {
    return {
      title: "Проект клиента · PhotoFlow",
      description: "Дата, памятка и статус вашего фотопроекта.",
      robots: { index: false, follow: false },
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  }
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClientPortal token={token} />;
}
