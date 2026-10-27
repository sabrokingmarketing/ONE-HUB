/**
 * Official-API social publishers. Each returns the platform's post id or throws a PublishError.
 *
 *  facebook  – Page feed: text, link-free photo(s) (multi-photo via unpublished uploads), single video.
 *  instagram – Content Publishing API: single JPEG image, single MP4 Reel, or carousel (2–10 items).
 *  linkedin  – Posts API for organisations: text, one or more images. (Video not supported yet.)
 *
 * Media is fetched by the platforms from the Convex storage URL (unguessable, HTTPS).
 * None of this has been exercised against the live platforms from the build environment;
 * the first real post must be a supervised test (see docs/INTEGRATIONS.md).
 */
export class PublishError extends Error {
  constructor(message: string, public retryable: boolean, public tokenInvalid = false) {
    super(message);
  }
}

export const GRAPH = {
  get version() { return process.env.META_GRAPH_VERSION ?? "v24.0"; },
  get base() { return `https://graph.facebook.com/${this.version}`; },
};
export const LINKEDIN_VERSION = () => process.env.LINKEDIN_API_VERSION ?? "202509";

export type Media = { url: string; contentType: string };
export type PublishArgs = {
  platform: "facebook" | "instagram" | "linkedin";
  externalId: string;
  accessToken: string;
  message: string;
  media: Media[];
};

const isVideo = (m: Media) => m.contentType.startsWith("video/");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Platform rules, also used to validate posts before they are scheduled. */
export function validateForPlatform(platform: PublishArgs["platform"], media: { contentType: string }[]): string | null {
  const videos = media.filter((m) => m.contentType.startsWith("video/")).length;
  if (platform === "facebook" && videos > 0 && media.length > 1) return "Facebook: a video post can only contain that one video.";
  if (platform === "instagram") {
    if (media.length === 0) return "Instagram needs at least one image or video.";
    if (media.some((m) => m.contentType === "image/png")) return "Instagram only accepts JPEG images — convert PNG files to JPEG.";
  }
  if (platform === "linkedin" && videos > 0) return "LinkedIn video posting isn't supported yet — use images or text.";
  if (platform === "linkedin" && media.length > 9) return "LinkedIn allows up to 9 images per post.";
  return null;
}

// ---------- Meta ----------

async function graph<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<T> {
  const body = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${GRAPH.base}/${path}?${body}` : `${GRAPH.base}/${path}`, method === "GET" ? undefined : { method, body });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_subcode?: number } };
  if (!res.ok || data.error) {
    const code = data.error?.code ?? -1;
    // 190 = invalid/expired token; 10/200-299 = permission missing → reauthorise. 4/17/32/613 = rate limits.
    const tokenInvalid = code === 190 || code === 10 || (code >= 200 && code < 300);
    const retryable = res.status >= 500 || [1, 2, 4, 17, 32, 341, 613].includes(code);
    throw new PublishError(`Meta: ${data.error?.message ?? res.statusText}`, retryable, tokenInvalid);
  }
  return data;
}

async function publishFacebook(a: PublishArgs) {
  const page = encodeURIComponent(a.externalId);
  const t = a.accessToken;
  if (a.media.length === 0) {
    const r = await graph<{ id: string }>(`${page}/feed`, { message: a.message, access_token: t });
    return r.id;
  }
  if (a.media.length === 1 && isVideo(a.media[0])) {
    const r = await graph<{ id: string }>(`${page}/videos`, { file_url: a.media[0].url, description: a.message, access_token: t });
    return r.id;
  }
  if (a.media.length === 1) {
    const r = await graph<{ id: string; post_id?: string }>(`${page}/photos`, { url: a.media[0].url, caption: a.message, access_token: t });
    return r.post_id ?? r.id;
  }
  // Multi-photo: upload unpublished photos, then attach them to one feed post.
  const ids: string[] = [];
  for (const m of a.media) {
    const r = await graph<{ id: string }>(`${page}/photos`, { url: m.url, published: "false", access_token: t });
    ids.push(r.id);
  }
  const params: Record<string, string> = { message: a.message, access_token: t };
  ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const r = await graph<{ id: string }>(`${page}/feed`, params);
  return r.id;
}

async function waitForContainer(id: string, token: string) {
  // Videos are processed asynchronously by Instagram; poll for up to ~5 minutes.
  for (let i = 0; i < 60; i++) {
    const s = await graph<{ status_code?: string; status?: string }>(id, { fields: "status_code,status", access_token: token }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new PublishError(`Instagram couldn't process the media (${s.status ?? s.status_code}).`, false);
    await sleep(5000);
  }
  throw new PublishError("Instagram is still processing the video after 5 minutes.", true);
}

async function publishInstagram(a: PublishArgs) {
  const ig = encodeURIComponent(a.externalId);
  const t = a.accessToken;
  const item = (m: Media, extra: Record<string, string>) =>
    isVideo(m) ? { media_type: extra.is_carousel_item ? "VIDEO" : "REELS", video_url: m.url, ...extra } : { image_url: m.url, ...extra };
  let creationId: string;
  if (a.media.length === 1) {
    const c = await graph<{ id: string }>(`${ig}/media`, { ...item(a.media[0], {}), caption: a.message, access_token: t });
    if (isVideo(a.media[0])) await waitForContainer(c.id, t);
    creationId = c.id;
  } else {
    const children: string[] = [];
    for (const m of a.media.slice(0, 10)) {
      const c = await graph<{ id: string }>(`${ig}/media`, { ...item(m, { is_carousel_item: "true" }), access_token: t });
      if (isVideo(m)) await waitForContainer(c.id, t);
      children.push(c.id);
    }
    const c = await graph<{ id: string }>(`${ig}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: a.message, access_token: t });
    await waitForContainer(c.id, t);
    creationId = c.id;
  }
  const r = await graph<{ id: string }>(`${ig}/media_publish`, { creation_id: creationId, access_token: t });
  return r.id;
}

// ---------- LinkedIn ----------

/** LinkedIn "little text format": reserved characters must be escaped in commentary. */
export function escapeLinkedIn(text: string) {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

async function linkedin(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.linkedin.com/rest/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LINKEDIN_VERSION(),
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new PublishError(`LinkedIn: ${data.message ?? res.statusText}`, res.status === 429 || res.status >= 500, res.status === 401);
  }
  return res;
}

async function publishLinkedIn(a: PublishArgs) {
  const imageUrns: string[] = [];
  for (const m of a.media) {
    const init = await linkedin("images?action=initializeUpload", a.accessToken, {
      method: "POST",
      body: JSON.stringify({ initializeUploadRequest: { owner: a.externalId } }),
    });
    const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
    const file = await fetch(m.url);
    if (!file.ok) throw new PublishError("Couldn't read the media file for LinkedIn.", true);
    const up = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${a.accessToken}` }, body: await file.arrayBuffer() });
    if (!up.ok) throw new PublishError(`LinkedIn image upload failed (${up.status}).`, up.status >= 500);
    imageUrns.push(value.image);
  }
  const content =
    imageUrns.length === 1 ? { media: { id: imageUrns[0] } } : imageUrns.length > 1 ? { multiImage: { images: imageUrns.map((id) => ({ id })) } } : undefined;
  const res = await linkedin("posts", a.accessToken, {
    method: "POST",
    body: JSON.stringify({
      author: a.externalId,
      commentary: escapeLinkedIn(a.message),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    }),
  });
  return res.headers.get("x-restli-id") ?? "unknown";
}

export async function publishToPlatform(a: PublishArgs): Promise<string> {
  const invalid = validateForPlatform(a.platform, a.media);
  if (invalid) throw new PublishError(invalid, false);
  if (a.platform === "facebook") return await publishFacebook(a);
  if (a.platform === "instagram") return await publishInstagram(a);
  return await publishLinkedIn(a);
}
