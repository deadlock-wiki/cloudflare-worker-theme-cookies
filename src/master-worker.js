import { handleWikiRequest } from "./wiki.js";
import { checkGameUpdate } from './game-update.js'

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        let finalRequest = request;

        // LOCAL DEV SHIELD
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            url.hostname = "deadlock.wiki";
            url.protocol = "https:";
            url.port = "";
            finalRequest = new Request(url, request);
        }

        return await handleWikiRequest(finalRequest, env);
    },

    async scheduled(event, eventEnv, ctx) {
        ctx.waitUntil(
            checkGameUpdate(eventEnv).catch((err) => {
                const errorMessage = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
                console.error(`game-update failed: ${errorMessage}`);
            })
        );
    },
};