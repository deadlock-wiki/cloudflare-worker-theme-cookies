import { getRecentChangesHTML } from "./recent-changes.js";
import { applyThemeRewriter } from "./theme-cookies.js";
import { applyFeedbackRewriter } from "./feedback.js";

function isCacheableRequest(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return false;

    const url = new URL(request.url);
    const pathname = url.pathname;
    const search = url.search;

    // Exclude special paths and internal endpoints
    if (pathname.includes("/Special:") || search.includes("Special:")) return false;
    if (["/api.php", "/rest.php", "/img_auth.php"].includes(pathname)) return false;

    // Exclude dynamic actions (allow empty query or action=view)
    if (search.includes("action=") && !search.includes("action=view")) return false;

    // Exclude logged-in users / session cookies
    const cookieHeader = request.headers.get("Cookie") || "";
    const bypassCookies = ["session", "UserID", "UserName", "LoggedOut", "Token"];
    if (bypassCookies.some((cookie) => cookieHeader.includes(cookie))) return false;

    return true;
}

export async function handleWikiRequest(request, env) {
    try {
        const url = new URL(request.url);

        // API ROUTE
        if (request.method === "GET" && url.pathname === "/api/recent-changes") {
            try {
                const html = await getRecentChangesHTML(env);

                if (!html) {
                    return new Response("Unable to build recent changes widget", {
                        status: 500,
                        headers: { "Content-Type": "text/plain; charset=utf-8" },
                    });
                }

                return new Response(
                    `<ul class="vector-menu-content-list recent-changes-list">${html}</ul>`,
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "text/html; charset=utf-8",
                            "Cache-Control": "no-store",
                        },
                    }
                );
            } catch {
                return new Response("Widget error", {
                    status: 500,
                    headers: { "Content-Type": "text/plain; charset=utf-8" },
                });
            }
        }

        const shouldCache = isCacheableRequest(request);

        // Fetch origin (apply Cloudflare cache configuration ONLY if request is eligible)
        const fetchOptions = shouldCache
            ? {
                  cf: {
                      cacheEverything: true,
                      cacheTtlByStatus: {
                          "200-299": 300,
                          "404": 30,
                          "500-599": 0,
                      },
                  },
              }
            : {};

        const originResponse = await fetch(request, fetchOptions);

        const contentType = originResponse.headers.get("Content-Type") || "";
        if (!contentType.toLowerCase().includes("text/html")) {
            return originResponse;
        }

        let widgetHtml = null;
        try {
            widgetHtml = await getRecentChangesHTML(env);
        } catch {
            widgetHtml = null;
        }

        const rewriter = new HTMLRewriter();

        try {
            applyThemeRewriter(rewriter, request);
        } catch {}

        try {
            applyFeedbackRewriter(rewriter);
        } catch {}

        if (widgetHtml) {
            rewriter.on("#p-Recent_changes ul.vector-menu-content-list", {
                element(el) {
                    el.setAttribute("class", "vector-menu-content-list recent-changes-list");
                    el.setInnerContent(widgetHtml, { html: true });
                },
            });
        }

        const transformedResponse = rewriter.transform(originResponse);

        // Override Cache-Control headers ONLY for public, anonymous GET requests
        if (shouldCache) {
            const responseHeaders = new Headers(transformedResponse.headers);
            responseHeaders.set("Cache-Control", "public, max-age=300, s-maxage=300");

            return new Response(transformedResponse.body, {
                status: transformedResponse.status,
                statusText: transformedResponse.statusText,
                headers: responseHeaders,
            });
        }

        return transformedResponse;

    } catch {
        return fetch(request);
    }
}
