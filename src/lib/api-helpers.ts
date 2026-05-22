import { NextResponse } from "next/server";
import { AuthError } from "./tenant";

/**
 * Handler padrão pra catch de API routes. AuthError vira o statusCode certo
 * (401 / 403). Demais erros viram 500 genérico com log estruturado.
 *
 * Uso:
 *   } catch (e) {
 *     return handleApiError(e, "CRM GET");
 *   }
 */
export function handleApiError(e: unknown, label: string): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.statusCode });
  }
  console.error(`[${label}] failed:`, e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
