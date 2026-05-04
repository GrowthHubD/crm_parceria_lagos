/**
 * Acesso ao admin de um cliente — re-emite magic link ou reseta senha.
 *
 * POST body:
 *   { action: "magic-link" }            → retorna { magicLink }
 *   { action: "reset-password", newPassword: string } → seta senha e retorna { adminEmail, newPassword }
 *
 * Permissões:
 *   - partner_admin: só pode operar em clientes com partner_id = seu tenant
 *   - superadmin: qualquer cliente
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getTenantContext } from "@/lib/tenant";
import { db } from "@/lib/db";
import { tenant } from "@/lib/db/schema/tenants";
import { user, userTenant } from "@/lib/db/schema/users";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("magic-link") }),
  z.object({
    action: z.literal("reset-password"),
    newPassword: z.string().min(8).max(72),
  }),
]);

function canAccess(role: string) {
  return role === "partner_admin" || role === "superadmin";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantContext(request.headers);
    if (!canAccess(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id: clientTenantId } = await params;

    // Valida que o cliente existe e pertence ao parceiro (se não for superadmin)
    const [target] = await db
      .select({ id: tenant.id, partnerId: tenant.partnerId, name: tenant.name })
      .from(tenant)
      .where(eq(tenant.id, clientTenantId))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    if (ctx.role !== "superadmin" && target.partnerId !== ctx.tenantId) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Busca o admin do tenant
    const [adminRow] = await db
      .select({ userId: user.id, email: user.email })
      .from(userTenant)
      .innerJoin(user, eq(user.id, userTenant.userId))
      .where(and(eq(userTenant.tenantId, clientTenantId), eq(userTenant.role, "admin")))
      .limit(1);

    if (!adminRow) {
      return NextResponse.json(
        { error: "Cliente não tem usuário admin associado" },
        { status: 404 }
      );
    }

    // Conta vínculos do user — se >1 (compartilhado entre tenants),
    // proíbe reset de senha (afetaria credencial em outros tenants).
    const allBindings = await db
      .select({ tenantId: userTenant.tenantId })
      .from(userTenant)
      .where(eq(userTenant.userId, adminRow.userId));
    const isShared = allBindings.length > 1;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const supa = getSupabaseAdmin();

    if (parsed.data.action === "magic-link") {
      const redirect = `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/onboarding/whatsapp`;
      const { data: linkData, error: linkError } = await supa.auth.admin.generateLink({
        type: "magiclink",
        email: adminRow.email,
        options: { redirectTo: redirect },
      });
      if (linkError) {
        return NextResponse.json(
          { error: `Falha ao gerar magic link: ${linkError.message}` },
          { status: 500 }
        );
      }
      const magicLink =
        // @ts-expect-error - properties.action_link existe no retorno
        linkData?.properties?.action_link ?? linkData?.action_link;
      return NextResponse.json({ adminEmail: adminRow.email, magicLink });
    }

    // reset-password
    if (isShared) {
      return NextResponse.json(
        {
          error: "SHARED_USER_RESET_FORBIDDEN",
          message:
            "Esse admin é compartilhado com outros tenants — resetar a senha aqui afetaria o login em todos. " +
            "Peça pro admin usar 'esqueci a senha' diretamente.",
          adminEmail: adminRow.email,
          tenantCount: allBindings.length,
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supa.auth.admin.updateUserById(adminRow.userId, {
      password: parsed.data.newPassword,
    });
    if (updateError) {
      return NextResponse.json(
        { error: `Falha ao resetar senha: ${updateError.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({
      adminEmail: adminRow.email,
      newPassword: parsed.data.newPassword,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[PARTNER] access action failed:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
