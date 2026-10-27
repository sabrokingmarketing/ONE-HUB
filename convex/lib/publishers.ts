/**
 * Official-API social publishers. Each returns the platform's post id or throws.
 *
 * STATUS (be honest in the UI):
 *  - facebook: implemented against the Graph API Page feed/photos endpoints. NOT YET
 *    VERIFIED against a live Page — requires a Meta app with pages_manage_posts
 *    (App Review) and a connected Page token.
 *  - instagram / linkedin: not implemented yet; they fail with a clear message.
 */
export class PublishError extends Error {
  constructor(message: string, public retryable: boolean) {
    super(message);
  }
}

const GRAPH = "https://graph.facebook.com/v21.0";

export async function publishToPlatform(args: {
  platform: "facebook" | "instagram" | "linkedin";
  externalId: string;
  accessToken: string;
  message: string;
  mediaUrls: string[];
}): Promise<string> {
  if (args.platform === "facebook") {
    const body = new URLSearchParams({ access_token: args.accessToken });
    let endpoint = `${GRAPH}/${encodeURIComponent(args.externalId)}/feed`;
    if (args.mediaUrls.length > 0) {
      endpoint = `${GRAPH}/${encodeURIComponent(args.externalId)}/photos`;
      body.set("url", args.mediaUrls[0]);
      body.set("caption", args.message);
    } else {
      body.set("message", args.message);
    }
    const res = await fetch(endpoint, { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string; code?: number } };
    if (!res.ok || data.error) {
      const code = data.error?.code;
      // 190 = invalid/expired token → not retryable, needs reauthorisation. 4/17/32/613 = rate limits.
      const retryable = res.status >= 500 || [4, 17, 32, 613].includes(code ?? -1);
      throw new PublishError(`Facebook: ${data.error?.message ?? res.statusText}`, retryable);
    }
    return data.post_id ?? data.id ?? "unknown";
  }
  throw new PublishError(`${args.platform} publishing is not implemented yet in ONE HUB.`, false);
}
