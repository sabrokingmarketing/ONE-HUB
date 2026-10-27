import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { linkedinCallback, metaCallback } from "./socialAuth";

const http = httpRouter();
auth.addHttpRoutes(http);

// OAuth redirect URIs — register these exact URLs with Meta and LinkedIn.
http.route({ path: "/oauth/meta/callback", method: "GET", handler: metaCallback });
http.route({ path: "/oauth/linkedin/callback", method: "GET", handler: linkedinCallback });

export default http;
