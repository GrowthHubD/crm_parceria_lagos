import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { whatsappNumber } from "@/lib/db/schema/crm";
import { tenant } from "@/lib/db/schema/tenants";
import { eq } from "drizzle-orm";
import {
  createInstance,
  getQrCode,
  getStatus,
  setWebhook,
  instanceIdFromSlug,
  WHATSAPP_PROVIDER,
} from "@/lib/whatsapp";
import type { UserRole } from "@/types";

/**
 * POST /api/uazapi/connect
 * Conecta o WhatsApp do tenant via provider atual (Evolution em dev, Uazapi em prod).
 * Reutiliza instância existente se houver, ou cria nova e retorna QR.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext(request.headers);
    const canEdit = await checkPermission(ctx.userId, ctx.role as UserRole, "configuracoes", "edit", ctx);
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const targetTenantId = (ctx.role === "superadmin" && body.tenantId) ? body.tenantId : ctx.tenantId;

    const [tenantData] = await db
      .select({ slug: tenant.slug, name: tenant.name })
      .from(tenant)
      .where(eq(tenant.id, targetTenantId))
      .limit(1);

    if (!tenantData) return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });

    // Webhook URL depende do provider — fallback evita "undefined/api/..." se env faltar.
    const appBase = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? new URL(request.url).origin;
    const webhookPath = WHATSAPP_PROVIDER === "uazapi"
      ? "/api/webhooks/uazapi/v2"
      : "/api/webhooks/evolution";
    const webhookUrl = `${appBase}${webhookPath}`;

    let [wNum] = await db
      .select()
      .from(whatsappNumber)
      .where(eq(whatsappNumber.tenantId, targetTenantId))
      .limit(1);

    const savedInstanceId = (wNum?.uazapiSession && wNum.uazapiSession !== "baileys")
      ? wNum.uazapiSession
      : null;

    // ── 1) Se já tem instância, checar se está aberta.
    // try/catch porque a instância pode ter sido apagada do lado Uazapi (404) —
    // nesse caso seguimos pro fluxo de recriação ao invés de quebrar com 500.
    if (savedInstanceId) {
      try {
        const status = await getStatus(savedInstanceId, wNum!.uazapiToken || undefined);
        if (status.state === "open") {
          return NextResponse.json({
            status: "connected",
            phoneNumber: status.phoneNumber ?? wNum!.phoneNumber,
            instanceId: wNum!.id,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[WHATSAPP] getStatus falhou para instância salva, recriando:", msg);
      }
    }

    const effectiveInstanceId = savedInstanceId ?? instanceIdFromSlug(tenantData.slug);

    // ── 2) Criar instância se necessário
    const createResult = await createInstance(effectiveInstanceId, webhookUrl);
    if (!createResult.ok) {
      console.error("[WHATSAPP] createInstance failed for tenant", targetTenantId, "—", createResult.error);
      const detail = createResult.error ?? "unknown";
      const isAuth = /401|403|admintoken|unauthorized/i.test(detail);
      const isNetwork = /fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(detail);
      const userMsg = isAuth
        ? "Provider WhatsApp recusou autenticação (verifique UAZAPI_ADMIN_TOKEN)"
        : isNetwork
        ? "Provider WhatsApp inacessível (verifique UAZAPI_BASE_URL e conectividade)"
        : `Falha ao criar instância: ${detail.slice(0, 200)}`;
      return NextResponse.json({ error: userMsg, step: "createInstance" }, { status: 502 });
    }
    const instanceToken = createResult.token ?? wNum?.uazapiToken ?? "";

    // ── 3) Upsert no banco
    if (!wNum) {
      [wNum] = await db
        .insert(whatsappNumber)
        .values({
          tenantId: targetTenantId,
          phoneNumber: `pending-${targetTenantId.slice(0, 8)}`,
          label: tenantData.name,
          uazapiSession: effectiveInstanceId,
          uazapiToken: instanceToken,
          isActive: false,
        })
        .returning();

      await db
        .update(tenant)
        .set({ uazapiInstanceId: wNum.id, updatedAt: new Date() })
        .where(eq(tenant.id, targetTenantId));
    } else {
      await db
        .update(whatsappNumber)
        .set({
          uazapiSession: effectiveInstanceId,
          ...(instanceToken ? { uazapiToken: instanceToken } : {}),
        })
        .where(eq(whatsappNumber.id, wNum.id));
    }

    // ── 4) Garantir webhook
    await setWebhook(effectiveInstanceId, webhookUrl, instanceToken || undefined);

    // ── 5) Buscar QR code
    let qr;
    try {
      qr = await getQrCode(effectiveInstanceId, instanceToken || undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[WHATSAPP] getQrCode failed for tenant", targetTenantId, "—", msg);
      return NextResponse.json(
        { error: `Falha ao gerar QR: ${msg.slice(0, 200)}`, step: "getQrCode" },
        { status: 502 }
      );
    }

    if (qr.connected) {
      return NextResponse.json({ status: "connected", instanceId: wNum.id });
    }

    if (!qr.qrCode) {
      return NextResponse.json(
        { error: "Provider devolveu resposta vazia (sem QR e sem conexão)", step: "getQrCode" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: "pending",
      qrCode: qr.qrCode,
      instanceId: wNum.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[WHATSAPP] Connect failed:", msg);
    return NextResponse.json({ error: `Erro interno: ${msg.slice(0, 200)}` }, { status: 500 });
  }
}
