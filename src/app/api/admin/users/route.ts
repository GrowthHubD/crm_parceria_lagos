import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { user, account } from "@/lib/db/schema/users";
import { modulePermission } from "@/lib/db/schema/users";
import { eq, asc } from "drizzle-orm";
import type { UserRole } from "@/types";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["partner", "manager", "operational"]).default("operational"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canView = await checkPermission(session.user.id, userRole, "admin", "view");
    if (!canView) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        jobTitle: user.jobTitle,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(asc(user.name));

    const permissions = await db.select().from(modulePermission);

    return NextResponse.json({ users, permissions });
  } catch {
    console.error("[ADMIN] GET users failed");
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userRole = ((session.user as { role?: string }).role ?? "operational") as UserRole;
    const canEdit = await checkPermission(session.user.id, userRole, "admin", "edit");
    if (!canEdit) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, role } = parsed.data;

    // Check if email already exists
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "Este email já está cadastrado." }, { status: 400 });
    }

    // Hash password using the same algorithm as better-auth:
    // scrypt with N=16384, r=16, p=1, dkLen=64 — stored as "hexsalt:hexkey"
    const { scrypt: nodeScrypt } = await import("node:crypto");
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = Buffer.from(saltBytes).toString("hex");
    const keyBuf = await new Promise<Buffer>((resolve, reject) => {
      nodeScrypt(
        password.normalize("NFKC"),
        salt,
        64,
        { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
        (err, key) => (err ? reject(err) : resolve(key))
      );
    });
    const hashedPassword = `${salt}:${keyBuf.toString("hex")}`;

    // Generate IDs the same way better-auth does (random base36-like string)
    const newUserId = crypto.randomUUID().replace(/-/g, "");
    const accountId = crypto.randomUUID().replace(/-/g, "");

    // Insert user row
    const [created] = await db.insert(user).values({
      id: newUserId,
      name,
      email,
      emailVerified: false,
      role,
      isActive: true,
    }).returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });

    // Insert account row (better-auth credential provider)
    await db.insert(account).values({
      id: accountId,
      accountId: newUserId,
      providerId: "credential",
      userId: newUserId,
      password: hashedPassword,
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN] POST create user failed:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
