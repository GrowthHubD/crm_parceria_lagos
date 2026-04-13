import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { uploadFileToDrive } from "@/lib/drive";
import type { UserRole } from "@/types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "contracts", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande (máx. 20MB)" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo não permitido. Use PDF, Word ou imagem." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { id, webViewLink } = await uploadFileToDrive(buffer, file.name, file.type, "Contratos");

    return NextResponse.json({ id, url: webViewLink });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao fazer upload";
    if (msg.includes("não configurado") || msg.includes("not configured")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error("[STORAGE] Upload failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
