/**
 * Google Drive helper using OAuth2 refresh token.
 * Required env vars:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REFRESH_TOKEN
 *   GOOGLE_DRIVE_FOLDER_ID  (ID da pasta no Drive onde guardar os ficheiros)
 */

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";

/**
 * Get (or create) a subfolder inside `parentFolderId`.
 * Returns the subfolder ID.
 */
async function getOrCreateSubfolder(parentFolderId: string, name: string): Promise<string> {
  const token = await getAccessToken();

  // Try to find existing folder with this name
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentFolderId}' in parents and trashed=false`
  );
  const searchRes = await fetch(`${DRIVE_FILES_API}?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files?.length > 0) return data.files[0].id as string;
  }

  // Create the folder
  const createRes = await fetch(DRIVE_FILES_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Drive subfolder: ${err}`);
  }

  const folder = await createRes.json();
  return folder.id as string;
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Drive não configurado. Defina GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN no .env"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao obter access token do Google: ${err}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Resposta inválida do Google OAuth: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

export async function uploadFileToDrive(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  subfolderName?: string,
  makePublic = false
): Promise<{ id: string; webViewLink: string; embedUrl: string }> {
  const token = await getAccessToken();
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Resolve target folder: subfolder inside root, or root itself
  let targetFolderId = rootFolderId;
  if (rootFolderId && subfolderName) {
    targetFolderId = await getOrCreateSubfolder(rootFolderId, subfolderName);
  }

  const metadata = {
    name: fileName,
    mimeType,
    ...(targetFolderId ? { parents: [targetFolderId] } : {}),
  };

  const boundary = "===growthhub===";
  const metaPart = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
  ].join("\r\n");

  const filePart = `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(metaPart, "utf-8"),
    Buffer.from(filePart, "utf-8"),
    Buffer.from(fileBuffer),
    Buffer.from(closing, "utf-8"),
  ]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload falhou (${uploadRes.status}): ${err}`);
  }

  const file = await uploadRes.json();
  const fileId = file.id as string;

  if (makePublic) {
    await fetch(`${DRIVE_FILES_API}/${fileId}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
  }

  return {
    id: fileId,
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    embedUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
  };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const token = await getAccessToken();
  await fetch(`${DRIVE_FILES_API}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
