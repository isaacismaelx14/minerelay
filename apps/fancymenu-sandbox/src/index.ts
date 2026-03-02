import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, posix } from "node:path";
import * as yauzl from "yauzl";

const PORT = Number.parseInt(process.env.PORT || "3210", 10) || 3210;
const API_KEY = process.env.FANCYMENU_SANDBOX_API_KEY || "sandbox-dev-key";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 12 * 1024 * 1024;
const PREVIEW_TTL_SECONDS =
  Number.parseInt(process.env.FANCYMENU_PREVIEW_TTL_SECONDS || "1800", 10) ||
  1800;
const FANCY_MENU_ROOT = "config/fancymenu";

type PreviewAsset = {
  contentType: string;
  payload: Buffer;
};

type PreviewRecord = {
  expiresAt: number;
  assets: Map<string, PreviewAsset>;
};

type PreviewModel = {
  titleText?: string;
  subtitleText?: string;
  playButtonLabel?: string;
  backgroundAssetId?: string;
  logoAssetId?: string;
  extraButtonLabels?: string[];
  notices?: string[];
};

type AnalyzeResult = {
  entryCount: number;
  totalUncompressedBytes: number;
  model: PreviewModel;
  assets: Map<string, PreviewAsset>;
};

const previewStore = new Map<string, PreviewRecord>();

function cleanupExpiredPreviews(): void {
  const now = Date.now();
  for (const [token, record] of previewStore.entries()) {
    if (record.expiresAt <= now) {
      previewStore.delete(token);
    }
  }
}

setInterval(cleanupExpiredPreviews, 30_000).unref();

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(body));
  response.end(body);
}

function sendError(
  response: ServerResponse,
  status: number,
  message: string,
): void {
  sendJson(response, status, { error: message });
}

async function readBufferBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    request.on("data", (chunk: Buffer | string) => {
      const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += payload.length;
      if (total > MAX_UPLOAD_BYTES) {
        reject(new Error(`Payload exceeds ${MAX_UPLOAD_BYTES} bytes`));
        request.destroy();
        return;
      }
      chunks.push(payload);
    });
    request.on("error", reject);
    request.on("end", () => {
      if (chunks.length === 0) {
        reject(new Error("Empty payload"));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

function containsControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function normalizeFancyMenuPath(value: string, fromZipEntry: boolean): string {
  const forward = value.replace(/\\/g, "/").trim();
  const cleaned = forward.endsWith("/") ? forward.slice(0, -1) : forward;
  if (!cleaned || cleaned.startsWith("/")) {
    throw new Error(`Unsafe ZIP path '${value}'`);
  }

  if (containsControlChar(cleaned) || cleaned.includes(":")) {
    throw new Error(`Unsafe ZIP path '${value}'`);
  }

  const normalized = posix.normalize(cleaned);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsafe ZIP path '${value}'`);
  }

  if (normalized.startsWith(`${FANCY_MENU_ROOT}/`)) {
    return normalized;
  }

  if (normalized === "config/fancymenu") {
    return FANCY_MENU_ROOT;
  }

  if (normalized.startsWith("fancymenu/")) {
    return `${FANCY_MENU_ROOT}/${normalized.slice("fancymenu/".length)}`;
  }

  if (normalized === "fancymenu") {
    return FANCY_MENU_ROOT;
  }

  if (fromZipEntry) {
    return `${FANCY_MENU_ROOT}/${normalized}`;
  }

  return posix.join(FANCY_MENU_ROOT, normalized);
}

function resolveFancyMenuSourceFilePath(
  sourcePath: string,
  rawReference: string,
): string {
  const trimmed = rawReference
    .trim()
    .replace(/^["']+/, "")
    .replace(/["']+$/, "");
  const normalizedReference = trimmed.replace(/\\/g, "/");
  if (!normalizedReference) {
    throw new Error(`Invalid FancyMenu source:file reference in ${sourcePath}`);
  }

  if (normalizedReference.includes("://")) {
    throw new Error(
      `FancyMenu source:file must be local path, got URL '${rawReference}'`,
    );
  }

  const candidate = normalizedReference.startsWith("/")
    ? normalizedReference.slice(1)
    : normalizedReference.startsWith("config/") ||
        normalizedReference.startsWith("fancymenu/")
      ? normalizedReference
      : posix.join(posix.dirname(sourcePath), normalizedReference);

  const resolved = normalizeFancyMenuPath(candidate, false);
  if (!resolved.startsWith(`${FANCY_MENU_ROOT}/`)) {
    throw new Error(
      `FancyMenu source:file reference escapes ${FANCY_MENU_ROOT}: ${rawReference}`,
    );
  }
  return resolved;
}

function inferImageContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

function createAssetId(): string {
  return randomBytes(8).toString("hex");
}

function isIgnorableBundleEntry(
  rawEntryName: string,
  normalizedPath: string,
): boolean {
  const raw = rawEntryName.replace(/\\/g, "/");
  const normalized = normalizedPath.replace(/\\/g, "/");
  const basename = posix.basename(normalized).toLowerCase();

  return (
    raw.includes("/__MACOSX/") ||
    raw.startsWith("__MACOSX/") ||
    normalized.includes("/__MACOSX/") ||
    basename === ".ds_store" ||
    basename.startsWith("._")
  );
}

function parsePreviewModel(
  textContents: string[],
): Omit<PreviewModel, "logoAssetId" | "backgroundAssetId"> {
  const merged = textContents.join("\n");
  const extract = (pattern: RegExp): string | undefined => {
    const match = pattern.exec(merged);
    return match?.[1]?.trim() || undefined;
  };

  const titleText =
    extract(/(?:^|\n)\s*(?:title|menu_title)\s*[:=]\s*["']?([^\n"']+)/i) ||
    extract(/(?:^|\n)\s*(?:main_title)\s*[:=]\s*["']?([^\n"']+)/i);
  const subtitleText =
    extract(/(?:^|\n)\s*(?:subtitle|description)\s*[:=]\s*["']?([^\n"']+)/i) ||
    extract(/(?:^|\n)\s*(?:server_subtitle)\s*[:=]\s*["']?([^\n"']+)/i);
  const playButtonLabel =
    extract(
      /(?:^|\n)\s*(?:play_button|playbutton|play_label|play)\s*[:=]\s*["']?([^\n"']+)/i,
    ) || undefined;

  const buttonMatches = Array.from(
    merged.matchAll(
      /(?:^|\n)\s*(?:button|btn)[^:=\n]{0,20}[:=]\s*["']?([A-Za-z0-9 _-]{2,32})/gi,
    ),
  )
    .map((match) => match[1]?.trim() || "")
    .filter((value) => value.length > 0)
    .slice(0, 4);

  return {
    titleText,
    subtitleText,
    playButtonLabel,
    extraButtonLabels: buttonMatches,
    notices: ["Custom bundle preview uses a simplified renderer."],
  };
}

async function analyzeBundle(
  payload: Buffer,
  includePreviewAssets: boolean,
): Promise<AnalyzeResult> {
  return new Promise((resolve, reject) => {
    const imageExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
    const blockedBinaryExt = new Set([
      ".exe",
      ".dll",
      ".bat",
      ".cmd",
      ".sh",
      ".jar",
      ".class",
      ".so",
      ".dylib",
      ".js",
      ".ts",
    ]);

    yauzl.fromBuffer(
      payload,
      {
        lazyEntries: true,
        validateEntrySizes: true,
        decodeStrings: true,
      },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(new Error("Invalid ZIP archive"));
          return;
        }

        let done = false;
        let entryCount = 0;
        let totalUncompressedBytes = 0;
        let totalAssetBytes = 0;
        let hasCustomizableMenus = false;
        let hasCustomizationTxt = false;
        let hasCustomizationMainTxt = false;
        const fileEntries = new Set<string>();
        const textFiles = new Map<string, string>();
        const assets = new Map<string, PreviewAsset>();
        const pathToAssetId = new Map<string, string>();

        const fail = (message: string) => {
          if (done) return;
          done = true;
          zipFile.close();
          reject(new Error(message));
        };

        const addImageAsset = (
          normalizedPath: string,
          imagePayload: Buffer,
        ) => {
          if (!includePreviewAssets) return;
          const assetId = createAssetId();
          pathToAssetId.set(normalizedPath, assetId);
          assets.set(assetId, {
            contentType: inferImageContentType(normalizedPath),
            payload: imagePayload,
          });
        };

        zipFile.on("error", () => fail("Invalid ZIP archive"));

        zipFile.on("entry", (entry: yauzl.Entry) => {
          if (done) return;

          entryCount += 1;
          if (entryCount > MAX_ENTRIES) {
            fail(`FancyMenu bundle exceeds ${MAX_ENTRIES} entries`);
            return;
          }

          let normalizedPath = "";
          try {
            normalizedPath = normalizeFancyMenuPath(entry.fileName, true);
          } catch (pathError) {
            fail((pathError as Error).message);
            return;
          }

          if (isIgnorableBundleEntry(entry.fileName, normalizedPath)) {
            zipFile.readEntry();
            return;
          }

          if (!normalizedPath.startsWith(`${FANCY_MENU_ROOT}/`)) {
            fail(
              `FancyMenu bundle entry is outside ${FANCY_MENU_ROOT}: ${entry.fileName}`,
            );
            return;
          }

          const isDirectory = entry.fileName.endsWith("/");
          if (isDirectory) {
            zipFile.readEntry();
            return;
          }

          const ext = extname(normalizedPath).toLowerCase();
          if (blockedBinaryExt.has(ext)) {
            fail(`Unsupported binary file type '${ext}' in bundle`);
            return;
          }

          totalUncompressedBytes += entry.uncompressedSize;
          if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
            fail(
              `FancyMenu bundle uncompressed size exceeds ${MAX_UNCOMPRESSED_BYTES} bytes`,
            );
            return;
          }

          fileEntries.add(normalizedPath);
          if (normalizedPath === `${FANCY_MENU_ROOT}/customizablemenus.txt`) {
            hasCustomizableMenus = true;
          }
          if (normalizedPath === `${FANCY_MENU_ROOT}/customization.txt`) {
            hasCustomizationTxt = true;
          }
          if (
            normalizedPath.toLowerCase() ===
            `${FANCY_MENU_ROOT}/customization/main.txt`
          ) {
            hasCustomizationMainTxt = true;
          }

          const isText = ext === ".txt";
          const isImage = imageExt.has(ext);
          if (!isText && !(includePreviewAssets && isImage)) {
            zipFile.readEntry();
            return;
          }

          zipFile.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail(`Failed to read ZIP entry ${entry.fileName}`);
              return;
            }

            const chunks: Buffer[] = [];
            let consumed = 0;
            stream.on("data", (chunk: Buffer | string) => {
              const data = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(chunk, "utf8");
              consumed += data.length;
              if (isText && consumed > MAX_TEXT_FILE_BYTES) {
                fail(`Text entry too large: ${normalizedPath}`);
                stream.destroy();
                return;
              }
              if (isImage && consumed > MAX_SINGLE_ASSET_BYTES) {
                fail(`Image entry too large: ${normalizedPath}`);
                stream.destroy();
                return;
              }
              chunks.push(data);
            });
            stream.on("error", () =>
              fail(`Failed to read ZIP entry ${entry.fileName}`),
            );
            stream.on("end", () => {
              if (done) return;
              const merged = Buffer.concat(chunks);
              if (isText) {
                const text = merged.toString("utf8");
                if (text.includes("\u0000")) {
                  fail(
                    `Binary content detected in text file ${normalizedPath}`,
                  );
                  return;
                }
                textFiles.set(normalizedPath, text);
              } else if (isImage) {
                totalAssetBytes += merged.length;
                if (totalAssetBytes > MAX_TOTAL_ASSET_BYTES) {
                  fail("Preview image assets exceed allowed total size");
                  return;
                }
                addImageAsset(normalizedPath, merged);
              }
              zipFile.readEntry();
            });
          });
        });

        zipFile.on("end", () => {
          if (done) return;

          if (!hasCustomizableMenus) {
            fail(
              `FancyMenu bundle is missing ${FANCY_MENU_ROOT}/customizablemenus.txt`,
            );
            return;
          }
          if (hasCustomizationTxt && hasCustomizationMainTxt) {
            fail(
              `FancyMenu bundle must not include both ${FANCY_MENU_ROOT}/customization.txt and ${FANCY_MENU_ROOT}/customization/main.txt`,
            );
            return;
          }
          if (!hasCustomizationTxt && !hasCustomizationMainTxt) {
            fail(
              `FancyMenu bundle must include ${FANCY_MENU_ROOT}/customization.txt or ${FANCY_MENU_ROOT}/customization/main.txt`,
            );
            return;
          }

          for (const [sourcePath, content] of textFiles.entries()) {
            const pattern = /\[source:file\]([^\s\r\n]+)/gi;
            let match = pattern.exec(content);
            while (match) {
              const rawReference = match[1]?.trim() ?? "";
              let resolvedPath = "";
              try {
                resolvedPath = resolveFancyMenuSourceFilePath(
                  sourcePath,
                  rawReference,
                );
              } catch (pathError) {
                fail((pathError as Error).message);
                return;
              }
              if (!fileEntries.has(resolvedPath)) {
                fail(
                  `FancyMenu reference not found: ${rawReference} (from ${sourcePath})`,
                );
                return;
              }
              match = pattern.exec(content);
            }
          }

          const parsedModel = parsePreviewModel(Array.from(textFiles.values()));
          let logoAssetId: string | undefined;
          let backgroundAssetId: string | undefined;

          for (const [path, id] of pathToAssetId.entries()) {
            const lower = path.toLowerCase();
            if (!logoAssetId && lower.includes("logo")) {
              logoAssetId = id;
            }
            if (
              !backgroundAssetId &&
              (lower.includes("background") ||
                lower.includes("/bg") ||
                lower.includes("backdrop"))
            ) {
              backgroundAssetId = id;
            }
          }

          if (!backgroundAssetId) {
            const first = pathToAssetId.values().next().value as
              | string
              | undefined;
            backgroundAssetId = first;
          }

          done = true;
          resolve({
            entryCount,
            totalUncompressedBytes,
            model: {
              ...parsedModel,
              logoAssetId,
              backgroundAssetId,
            },
            assets,
          });
        });

        zipFile.readEntry();
      },
    );
  });
}

function isAuthorized(request: IncomingMessage): boolean {
  const key = request.headers["x-api-key"];
  if (typeof key !== "string") {
    return false;
  }
  return key === API_KEY;
}

const server = createServer(async (request, response) => {
  const method = request.method || "GET";
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || "localhost"}`,
  );
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "fancymenu-sandbox" });
    return;
  }

  if (!isAuthorized(request)) {
    sendError(response, 401, "Unauthorized");
    return;
  }

  try {
    if (method === "POST" && pathname === "/internal/fancymenu/validate") {
      const payload = await readBufferBody(request);
      const analyzed = await analyzeBundle(payload, false);
      sendJson(response, 200, {
        entryCount: analyzed.entryCount,
        totalUncompressedBytes: analyzed.totalUncompressedBytes,
      });
      return;
    }

    if (method === "POST" && pathname === "/internal/fancymenu/preview") {
      const payload = await readBufferBody(request);
      const analyzed = await analyzeBundle(payload, true);
      const token = randomBytes(12).toString("hex");
      const expiresAt = Date.now() + PREVIEW_TTL_SECONDS * 1000;
      previewStore.set(token, {
        expiresAt,
        assets: analyzed.assets,
      });
      sendJson(response, 200, {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        model: analyzed.model,
        assets: Array.from(analyzed.assets.entries()).map(([id, asset]) => ({
          id,
          contentType: asset.contentType,
        })),
      });
      return;
    }

    if (
      method === "GET" &&
      pathname.startsWith("/internal/fancymenu/preview/assets/")
    ) {
      const [, , , , , token, assetId] = pathname.split("/");
      if (!token || !assetId) {
        sendError(response, 400, "Missing token or asset id");
        return;
      }
      const record = previewStore.get(token);
      if (!record || record.expiresAt <= Date.now()) {
        previewStore.delete(token);
        sendError(response, 404, "Preview token not found");
        return;
      }

      const asset = record.assets.get(assetId);
      if (!asset) {
        sendError(response, 404, "Preview asset not found");
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", asset.contentType);
      response.setHeader("cache-control", "private, max-age=60");
      response.setHeader("content-length", asset.payload.length);
      response.end(asset.payload);
      return;
    }

    sendError(response, 404, "Not found");
  } catch (error) {
    sendError(response, 400, (error as Error).message || "Request failed");
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[fancymenu-sandbox] listening on port ${PORT}`);
});
