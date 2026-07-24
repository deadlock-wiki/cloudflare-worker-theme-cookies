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

    async scheduled(event, env, ctx) {
        ctx.waitUntil(
            checkGameUpdate(env).catch((err) => {
                console.error('game-update failed:', err);
            })
        );
    },
};