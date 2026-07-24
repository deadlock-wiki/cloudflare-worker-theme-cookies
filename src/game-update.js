export async function checkGameUpdate(env) {
    const latestHash = await getLatestHash(env.DEADBOT_GH_TOKEN);
    const state = env.GAME_UPDATE_STATE;
    const previousHash = await state.get('last_hash');

    if (latestHash === previousHash) {
        console.info('Latest hash has not changed');
        return;
    }

    console.info(`New hash ${latestHash} found, dispatching Deadbot`)
    await dispatchDeadbot(env.DEADBOT_GH_TOKEN);
    await state.put('last_hash', latestHash);
    console.info('✅ Done!')
}

async function getLatestHash(ghToken) {
    const STEAMDB_REPO_LATEST_COMMIT_URL = 'https://api.github.com/repos/SteamDatabase/GameTracking-Deadlock/commits?per_page=1';

    const res = await fetch(STEAMDB_REPO_LATEST_COMMIT_URL, {
        headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'deadlock-wiki-worker',
        },
        cf: { cacheTtl: 0 },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch latest hash from SteamDB repo: ${res.status}`);
    }

    const data = await res.json();
    const sha = data?.[0]?.sha;

    if (!sha) {
        throw new Error('Commit hash not found in response body');
    }

    return sha;
}

async function dispatchDeadbot(ghToken) {    
    const DISPATCH_URL = 'https://api.github.com/repos/deadlock-wiki/deadbot/actions/workflows/auto-deploy.yaml/dispatches';
    const res = await fetch(DISPATCH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'deadlock-wiki-worker',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ref: 'develop',
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub workflow dispatch failed: ${res.status} ${body}`);
    }
}
