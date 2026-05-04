/**
 * Auto-provisionamento de cliente (Fase 4.1).
 *
 * Quando um parceiro (partner_admin) cria um novo cliente, esta função
 * orquestra tudo em sequência:
 *   1. Cria tenant com partner_id apontando pro parceiro
 *   2. Cria instância WhatsApp (Uazapi em prod, Evolution em dev)
 *   3. Grava whatsapp_number com credenciais retornadas
 *   4. Cria pipeline default com 5 stages padrão
 *   5. (Pendente quando migrar pra Supabase Auth) cria user admin + magic link
 */

import { db } from "./db";
import { tenant } from "./db/schema/tenants";
import { user, userTenant } from "./db/schema/users";
import { whatsappNumber } from "./db/schema/crm";
import { pipeline, pipelineStage } from "./db/schema/pipeline";
import { createInstance, instanceIdFromSlug } from "./whatsapp";
import { getSupabaseAdmin } from "./supabase/admin";
import { eq } from "drizzle-orm";

export interface ProvisionClientInput {
  partnerId: string;
  name: string;
  slug: string; // alfanumérico, único globalmente
  billingEmail?: string;
  plan?: "free" | "pro" | "enterprise";
  /** Email do admin do cliente. Se fornecido, cria user Supabase Auth + magic link */
  adminEmail?: string;
  adminName?: string;
  /** Senha opcional. Se fornecida (e o user for novo), permite login por email/senha além do magic link. */
  adminPassword?: string;
}

export interface ProvisionClientResult {
  tenantId: string;
  whatsappNumberId: string;
  instanceId: string;
  pipelineId: string;
  adminUserId?: string;
  adminEmail?: string;
  /** True quando a senha foi efetivamente definida no user (apenas em criação nova). */
  passwordSet?: boolean;
  magicLink?: string;
  warnings: string[];
}

const DEFAULT_STAGES = [
  { name: "Novo", order: 0, color: "#6B7280", isWon: false },
  { name: "Em contato", order: 1, color: "#3B82F6", isWon: false },
  { name: "Negociação", order: 2, color: "#F59E0B", isWon: false },
  { name: "Ganho", order: 3, color: "#10B981", isWon: true },
  { name: "Perdido", order: 4, color: "#EF4444", isWon: false },
];

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function provisionClient(
  input: ProvisionClientInput
): Promise<ProvisionClientResult> {
  const warnings: string[] = [];
  const slug = normalizeSlug(input.slug);

  // 1) Valida slug único
  const [existing] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.slug, slug))
    .limit(1);
  if (existing) {
    throw new Error(`Slug "${slug}" já está em uso por outro tenant`);
  }

  // 2) Cria tenant
  const [newTenant] = await db
    .insert(tenant)
    .values({
      name: input.name,
      slug,
      isPlatformOwner: false,
      isPartner: false,
      partnerId: input.partnerId,
      plan: input.plan ?? "pro",
      billingEmail: input.billingEmail ?? null,
      billingStatus: "active",
      status: "active",
    })
    .returning({ id: tenant.id });

  // 3) Cria instância WhatsApp (Uazapi em prod, Evolution em dev)
  const instanceId = instanceIdFromSlug(slug);
  const webhookUrl = `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/webhooks/${
    process.env.NODE_ENV === "production" ? "uazapi/v2" : "evolution"
  }`;

  let instanceToken: string | undefined;
  try {
    const result = await createInstance(instanceId, webhookUrl);
    if (!result.ok) {
      warnings.push("Falha ao criar instância WhatsApp — será criada no primeiro /connect");
    }
    instanceToken = result.token;
  } catch {
    warnings.push("Provider WhatsApp indisponível — cliente pode conectar manualmente depois");
  }

  // 4) Grava whatsapp_number (phoneNumber "pending" até QR ser escaneado)
  const [wNum] = await db
    .insert(whatsappNumber)
    .values({
      tenantId: newTenant.id,
      label: input.name,
      phoneNumber: `pending-${newTenant.id.slice(0, 8)}`,
      uazapiSession: instanceId,
      uazapiToken: instanceToken ?? "",
      isActive: false,
    })
    .returning({ id: whatsappNumber.id });

  // Link tenant → whatsapp_number principal
  await db
    .update(tenant)
    .set({ uazapiInstanceId: wNum.id, updatedAt: new Date() })
    .where(eq(tenant.id, newTenant.id));

  // 5) Cria pipeline default
  const [newPipeline] = await db
    .insert(pipeline)
    .values({
      tenantId: newTenant.id,
      name: "Funil principal",
      description: "Funil padrão criado no onboarding",
      isDefault: true,
    })
    .returning({ id: pipeline.id });

  // 6) Cria stages padrão
  await db.insert(pipelineStage).values(
    DEFAULT_STAGES.map((s) => ({
      tenantId: newTenant.id,
      pipelineId: newPipeline.id,
      name: s.name,
      order: s.order,
      color: s.color,
      isWon: s.isWon,
    }))
  );

  // 7) (Opcional) Cria user admin do cliente + magic link
  let adminUserId: string | undefined;
  let magicLink: string | undefined;
  let passwordSet = false;

  if (input.adminEmail) {
    const supa = getSupabaseAdmin();

    // 7.1) Resolve user no Supabase Auth (cria ou recupera + reseta senha se vier)
    const { data: listData } = await supa.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email === input.adminEmail);

    if (existing) {
      adminUserId = existing.id;
      if (input.adminPassword) {
        const { error: updateError } = await supa.auth.admin.updateUserById(existing.id, {
          password: input.adminPassword,
        });
        if (updateError) {
          throw new Error(`Falha ao atualizar senha do admin existente: ${updateError.message}`);
        }
        passwordSet = true;
      }
    } else {
      const { data: createData, error: createError } = await supa.auth.admin.createUser({
        email: input.adminEmail,
        email_confirm: true,
        user_metadata: { name: input.adminName ?? input.name },
        ...(input.adminPassword ? { password: input.adminPassword } : {}),
      });
      if (createError || !createData.user) {
        throw new Error(`Falha ao criar admin no Supabase: ${createError?.message ?? "unknown"}`);
      }
      adminUserId = createData.user.id;
      passwordSet = !!input.adminPassword;
    }

    // 7.2) Espelha em public.user — detecta collision de email com outro id
    const [byEmail] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.adminEmail))
      .limit(1);

    if (byEmail && byEmail.id !== adminUserId) {
      throw new Error(
        `Email ${input.adminEmail} já está vinculado a outro usuário (id=${byEmail.id}). Use email diferente.`
      );
    }

    if (!byEmail) {
      await db.insert(user).values({
        id: adminUserId,
        name: input.adminName ?? input.name,
        email: input.adminEmail,
        emailVerified: true,
        role: "admin",
        isActive: true,
      });
    }

    // 7.3) Vincula ao tenant como admin (idempotente)
    await db
      .insert(userTenant)
      .values({
        userId: adminUserId,
        tenantId: newTenant.id,
        role: "admin",
        isDefault: true,
      })
      .onConflictDoNothing();

    // 7.4) Magic link (redireciona pra /onboarding/whatsapp após login)
    const redirect = `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/onboarding/whatsapp`;
    const { data: linkData, error: linkError } = await supa.auth.admin.generateLink({
      type: "magiclink",
      email: input.adminEmail,
      options: { redirectTo: redirect },
    });
    if (linkError) {
      warnings.push(`Magic link não gerado: ${linkError.message}`);
    } else {
      // @ts-expect-error - action_link existe no retorno mas TS não reconhece
      magicLink = linkData?.properties?.action_link ?? linkData?.action_link;
    }
  }

  return {
    tenantId: newTenant.id,
    whatsappNumberId: wNum.id,
    instanceId,
    pipelineId: newPipeline.id,
    adminUserId,
    adminEmail: input.adminEmail,
    passwordSet,
    magicLink,
    warnings,
  };
}
