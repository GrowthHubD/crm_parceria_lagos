import { db } from "./db";
import { whatsappNumber } from "./db/schema/crm";
import { crmConversation } from "./db/schema/crm";
import { eq, and } from "drizzle-orm";

// ============================================
// Uazapi Client
// ============================================

export class UazapiClient {
  constructor(
    private baseUrl: string,
    private session: string,
    private token: string
  ) {}

  private get headers() {
    return {
      "Content-Type": "application/json",
      SessionKey: this.session,
      Token: this.token,
    };
  }

  async sendText(
    phone: string,
    message: string,
    mentionedJid?: string[]
  ): Promise<{ messageId?: string }> {
    const body: Record<string, unknown> = { phone, message };
    if (mentionedJid?.length) body.mentionedJid = mentionedJid;

    const res = await fetch(`${this.baseUrl}/sendText`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Uazapi sendText failed: ${res.status} ${text}`);
    }

    const data = await res.json().catch(() => ({}));
    return { messageId: data?.key?.id ?? undefined };
  }

  async getStatus(): Promise<{ connected: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        method: "GET",
        headers: this.headers,
      });
      if (!res.ok) return { connected: false };
      const data = await res.json();
      return { connected: data?.connected ?? false };
    } catch {
      return { connected: false };
    }
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Busca o whatsappNumber ativo do tenant e retorna um UazapiClient configurado.
 */
export async function getUazapiClientForTenant(
  tenantId: string
): Promise<UazapiClient | null> {
  const baseUrl = process.env.UAZAPI_BASE_URL;
  if (!baseUrl) return null;

  const [wNum] = await db
    .select()
    .from(whatsappNumber)
    .where(
      and(
        eq(whatsappNumber.tenantId, tenantId),
        eq(whatsappNumber.isActive, true)
      )
    )
    .limit(1);

  if (!wNum) return null;
  return new UazapiClient(baseUrl, wNum.uazapiSession, wNum.uazapiToken);
}

/**
 * Busca o whatsappNumber por conversationId e retorna client + dados da conversation.
 */
export async function getUazapiClientForConversation(conversationId: string) {
  const baseUrl = process.env.UAZAPI_BASE_URL;
  if (!baseUrl) return null;

  const [row] = await db
    .select({
      conversationId: crmConversation.id,
      contactPhone: crmConversation.contactPhone,
      whatsappNumberId: crmConversation.whatsappNumberId,
      tenantId: crmConversation.tenantId,
      uazapiSession: whatsappNumber.uazapiSession,
      uazapiToken: whatsappNumber.uazapiToken,
    })
    .from(crmConversation)
    .innerJoin(
      whatsappNumber,
      eq(crmConversation.whatsappNumberId, whatsappNumber.id)
    )
    .where(eq(crmConversation.id, conversationId))
    .limit(1);

  if (!row) return null;

  return {
    client: new UazapiClient(baseUrl, row.uazapiSession, row.uazapiToken),
    conversation: {
      id: row.conversationId,
      contactPhone: row.contactPhone,
      tenantId: row.tenantId,
    },
  };
}

// ============================================
// Webhook helpers (extraídos do webhook route)
// ============================================

export function extractPhone(jid: string): string {
  return jid.replace(/@.*$/, "").replace(/[^0-9]/g, "");
}

export interface ExtractedContent {
  content: string | null;
  mediaType: string;
}

export function extractContent(payload: Record<string, unknown>): ExtractedContent {
  const data = payload.data as Record<string, unknown> | undefined;
  const msg = data?.message as Record<string, unknown> | undefined;

  if (!msg) return { content: null, mediaType: "text" };

  // Texto simples
  if (typeof msg.conversation === "string") {
    return { content: msg.conversation, mediaType: "text" };
  }

  // Texto estendido
  const ext = msg.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext?.text && typeof ext.text === "string") {
    return { content: ext.text, mediaType: "text" };
  }

  // Mídia
  const imageMsg = msg.imageMessage as Record<string, unknown> | undefined;
  if (imageMsg) {
    return {
      content: (imageMsg.caption as string) ?? null,
      mediaType: "image",
    };
  }

  const videoMsg = msg.videoMessage as Record<string, unknown> | undefined;
  if (videoMsg) {
    return {
      content: (videoMsg.caption as string) ?? null,
      mediaType: "video",
    };
  }

  if (msg.audioMessage) return { content: null, mediaType: "audio" };

  const docMsg = msg.documentMessage as Record<string, unknown> | undefined;
  if (docMsg) {
    return {
      content: (docMsg.fileName as string) ?? null,
      mediaType: "document",
    };
  }

  return { content: null, mediaType: "text" };
}
