import { createHash } from "https://deno.land/std@0.98.0/hash/mod.ts";
import { Status } from "https://deno.land/std@0.129.0/http/http_status.ts";
import { parse } from "https://deno.land/std@0.129.0/flags/mod.ts";
import { ensureDirSync } from "https://deno.land/std@0.129.0/fs/mod.ts";
import { assertObjectMatch } from "https://deno.land/std@0.129.0/testing/asserts.ts";
import { retryAsync, isTooManyTries } from "https://deno.land/x/retry@v2.0.0/mod.ts";
import * as ed from "https://deno.land/x/ed25519@1.6.0/mod.ts";
import Client, { HTTP } from "https://cdn.jsdelivr.net/npm/drand-client@0.2.0/drand.js";
const DENO_LOCK_FILE = "lock.json";
const ENTROPY_FILE = "entropy.json";
const ENTROPY_DIR = "./entropy";
const PREV_ENTROPY_FILE = `${ENTROPY_DIR}/entropy_previous.json`;
const INDEX_DIR = "index/by/entropy_hash";
const HASH_TYPE = "sha256";
const HASH_ITERATIONS = 500000;
const SHA1_REGEX = /^(?:(0x)*([A-Fa-f0-9]{2}){20})$/i;
const SHA256_REGEX = /^(?:(0x)*([A-Fa-f0-9]{2}){32})$/i;
const NOW = new Date();
const GET_TIMEOUT = 5000;
async function readJSON(path) {
    try {
        const text = await Deno.readTextFile(path);
        return JSON.parse(text);
    }
    catch (_error) {
        return undefined;
    }
}
export async function get(url, timeout = GET_TIMEOUT) {
    const ret = {};
    try {
        const c = new AbortController();
        const id = setTimeout(() => c.abort(), timeout);
        const res = await fetch(url, { signal: c.signal });
        clearTimeout(id);
        ret.ok = true;
        ret.data = await res.json();
    }
    catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError')
            ret.err = Status.RequestTimeout;
        else
            ret.err = Status.ServiceUnavailable;
    }
    return ret;
}
async function putKVLatest(body, timeout = GET_TIMEOUT) {
    const accountIdentifier = Deno.env.get('CF_ACCOUNT_ID');
    const namespaceIdentifier = Deno.env.get('CF_NAMESPACE_ID');
    const keyName = "latest";
    const expirationTtl = 60 * 6;
    const authEmail = Deno.env.get('CF_AUTH_EMAIL') || '';
    const authKey = Deno.env.get('CF_AUTH_KEY') || '';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountIdentifier}/storage/kv/namespaces/${namespaceIdentifier}/values/${keyName}?expiration_ttl=${expirationTtl}`;
    const ret = {};
    try {
        const c = new AbortController();
        const id = setTimeout(() => c.abort(), timeout);
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                "X-Auth-Email": authEmail,
                "X-Auth-Key": authKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: c.signal
        });
        clearTimeout(id);
        ret.ok = true;
        ret.data = await res.json();
    }
    catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError')
            ret.err = Status.RequestTimeout;
        else
            ret.err = Status.ServiceUnavailable;
    }
    return ret;
}
async function writeJSON(path, data) {
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
}
function getPrivateKey() {
    const privKey = Deno.env.get("ED25519_PRIVATE_KEY") || "";
    if (!privKey || privKey === "") {
        throw new Error("missing required environment variable ED25519_PRIVATE_KEY");
    }
    return privKey;
}
async function getPublicKey() {
    const publicKey = await retryAsync(async () => {
        console.log("verify : retrieve public key");
        const resp = await get("https://entropy.truestamp.com/pubkey");
        if (resp.err) {
            throw new Error(`failed to fetch : status code ${resp.err}`);
        }
        const { data: publicKeyObj } = resp;
        const publicKey = publicKeyObj?.key;
        if (!publicKey || publicKey === "") {
            throw new Error("failed to retrieve required ed25519 public key from https://entropy.truestamp.com/pubkey");
        }
        return publicKey;
    }, { delay: 1000, maxTry: 3 });
    return publicKey;
}
const getFiles = () => {
    const files = [];
    for (const dirEntry of Deno.readDirSync(ENTROPY_DIR)) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".json")) {
            files.push({ name: dirEntry.name });
        }
    }
    files.map((file) => {
        const data = Deno.readFileSync(`${ENTROPY_DIR}/${file.name}`);
        const hash = createHash(HASH_TYPE);
        hash.update(data);
        file.hash = hash.toString();
        file.hashType = HASH_TYPE;
        return file;
    });
    const sortedFiles = files.sort(function (a, b) {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) {
            return -1;
        }
        if (nameA > nameB) {
            return 1;
        }
        return 0;
    });
    return sortedFiles;
};
const concatenateFileHashes = (files) => {
    const hashes = [];
    for (const file of files) {
        hashes.push(file.hash);
    }
    return hashes.join("");
};
const genSlowHash = (hash) => {
    let newHash = hash;
    for (let i = 0; i < HASH_ITERATIONS; i++) {
        const hash = createHash(HASH_TYPE);
        hash.update(newHash);
        newHash = hash.toString();
    }
    return newHash;
};
const genEntropy = async () => {
    const files = getFiles();
    const concatenatedFileHashes = concatenateFileHashes(files);
    const slowHash = genSlowHash(concatenatedFileHashes);
    const entropy = {
        files: files,
        hashType: HASH_TYPE,
        hashIterations: HASH_ITERATIONS,
        hash: slowHash,
        createdAt: NOW.toISOString(),
    };
    let hashSig;
    if (parsedArgs["entropy-generate"]) {
        hashSig = await ed.sign(entropy.hash, getPrivateKey());
        entropy.signature = ed.utils.bytesToHex(hashSig);
    }
    const prevEntropy = await readJSON(PREV_ENTROPY_FILE);
    entropy.prevHash = prevEntropy?.hash;
    console.log(JSON.stringify(entropy, null, 2));
    return entropy;
};
const parsedArgs = parse(Deno.args, {
    boolean: [
        "clean",
        "collect",
        "collect-timestamp",
        "collect-bitcoin",
        "collect-ethereum",
        "collect-stellar",
        "collect-drand",
        "collect-hn",
        "collect-nist",
        "collect-user-entropy",
        "entropy-generate",
        "entropy-verify",
        "entropy-index",
        "entropy-upload-kv"
    ],
});
if (parsedArgs["clean"]) {
    console.log("clean");
    for (const dirEntry of Deno.readDirSync(".")) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".json") &&
            dirEntry.name !== ENTROPY_FILE &&
            dirEntry.name !== DENO_LOCK_FILE) {
            Deno.removeSync(dirEntry.name);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-timestamp"]) {
    await retryAsync(async () => {
        console.log("collect attempt : timestamp");
        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/timestamp.json`, {
            timestamp: NOW.toISOString(),
        });
    }, { delay: 1000, maxTry: 3 });
}
if (parsedArgs["collect"] || parsedArgs["collect-bitcoin"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : bitcoin");
            const resp = await get("https://blockchain.info/latestblock");
            if (resp.err) {
                throw new Error(`failed to fetch : status code ${resp.err}`);
            }
            const { data } = resp;
            const { height, hash, time, block_index: blockIndex } = data;
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/bitcoin.json`, {
                height,
                hash,
                time,
                blockIndex,
            });
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect bitcoin tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect bitcoin failed : ${error.message}`);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-ethereum"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : ethereum");
            const resp = await get("https://api.blockcypher.com/v1/eth/main");
            if (resp.err) {
                throw new Error(`failed to fetch : status code ${resp.err}`);
            }
            const { data } = resp;
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/ethereum.json`, data);
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect ethereum tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect ethereum failed : ${error.message}`);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-nist"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : nist-beacon");
            const resp = await get("https://beacon.nist.gov/beacon/2.0/pulse/last");
            if (resp.err) {
                throw new Error(`failed to fetch : status code ${resp.err}`);
            }
            const { data } = resp;
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/nist-beacon.json`, data);
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect nist-beacon tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect nist-beacon failed : ${error.message}`);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-user-entropy"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : user-entropy");
            const resp = await get("https://entropy.truestamp.com/entries");
            if (resp.err) {
                throw new Error(`failed to fetch : status code ${resp.err}`);
            }
            const { data } = resp;
            if (!Array.isArray(data)) {
                throw new Error(`collect attempt : user-entropy : expected Array, got ${data}`);
            }
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/user-entropy.json`, { data });
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect user-entropy tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect user-entropy failed : ${error.message}`);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-stellar"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : stellar");
            const respStats = await get("https://horizon.stellar.org/fee_stats");
            if (respStats.err) {
                throw new Error(`failed to fetch : status code ${respStats.err}`);
            }
            const { data: feeStats } = respStats;
            const respLedger = await get(`https://horizon.stellar.org/ledgers/${feeStats.last_ledger}`);
            if (respLedger.err) {
                throw new Error(`failed to fetch : status code ${respLedger.err}`);
            }
            const { data: latestLedger } = respLedger;
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/stellar.json`, latestLedger);
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect stellar tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect stellar failed : ${error.message}`);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-drand"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : drand-beacon");
            const urls = [
                "https://drand.cloudflare.com",
            ];
            const resp = await get("https://drand.cloudflare.com/info");
            if (resp.err) {
                throw new Error(`failed to fetch : status code ${resp.err}`);
            }
            const { data: chainInfo } = resp;
            const options = { chainInfo };
            const client = await Client.wrap(HTTP.forURLs(urls, chainInfo.hash), options);
            const randomness = await client.get();
            await client.close();
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/drand-beacon.json`, {
                chainInfo,
                randomness,
            });
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect drand tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect drand failed : ${error.message}`);
        }
    }
}
if (parsedArgs["collect"] || parsedArgs["collect-hn"]) {
    try {
        await retryAsync(async () => {
            console.log("collect attempt : hacker-news");
            const resp = await get("https://hacker-news.firebaseio.com/v0/newstories.json");
            if (resp.err) {
                throw new Error(`failed to fetch : status code ${resp.err}`);
            }
            const { data: newsStories } = resp;
            const stories = [];
            for (let i = 0; i < 10; i++) {
                const respStory = await get(`https://hacker-news.firebaseio.com/v0/item/${newsStories[i]}.json`);
                if (respStory.err) {
                    throw new Error(`failed to fetch : status code ${respStory.err}`);
                }
                const { data: story } = respStory;
                stories.push(story);
            }
            ensureDirSync(ENTROPY_DIR);
            await writeJSON(`${ENTROPY_DIR}/hacker-news.json`, { stories });
        }, { delay: 1000, maxTry: 3 });
    }
    catch (error) {
        if (isTooManyTries(error)) {
            console.error(`collect hacker news tooManyTries : ${error.message}`);
        }
        else {
            console.error(`collect hacker news failed : ${error.message}`);
        }
    }
}
if (parsedArgs["entropy-generate"]) {
    if (await readJSON(ENTROPY_FILE)) {
        Deno.copyFileSync(ENTROPY_FILE, PREV_ENTROPY_FILE);
        console.log(`entropy : copied to '${PREV_ENTROPY_FILE}'`);
    }
    const entropy = await genEntropy();
    await writeJSON(ENTROPY_FILE, entropy);
    console.log("entropy : generated");
}
if (parsedArgs["entropy-verify"]) {
    const currentEntropy = await readJSON(ENTROPY_FILE);
    if (!currentEntropy) {
        throw new Error(`required file '${ENTROPY_FILE}' not found`);
    }
    const publicKey = await getPublicKey();
    if (!publicKey) {
        throw new Error("unable to retrieve public key for verification");
    }
    if (!await ed.verify(currentEntropy.signature, currentEntropy.hash, publicKey)) {
        throw new Error("invalid hash signature");
    }
    const entropy = await genEntropy();
    delete currentEntropy.createdAt;
    delete entropy.createdAt;
    assertObjectMatch(currentEntropy, entropy);
    console.log("entropy : verified");
}
if (parsedArgs["entropy-index"]) {
    const parentCommitId = Deno.env.get("PARENT_COMMIT_ID") || "";
    if (!SHA1_REGEX.test(parentCommitId)) {
        throw new Error("invalid PARENT_COMMIT_ID environment variable, must be SHA1 commit ID");
    }
    const prevEntropy = await readJSON(PREV_ENTROPY_FILE);
    if (prevEntropy) {
        const prevEntropyHash = prevEntropy?.hash;
        if (!prevEntropyHash || !SHA256_REGEX.test(prevEntropyHash)) {
            throw new Error("missing or invalid entropy hash in file");
        }
        Deno.mkdirSync(INDEX_DIR, { recursive: true });
        await writeJSON(`${INDEX_DIR}/${prevEntropyHash}.json`, {
            id: parentCommitId,
        });
        console.log(`entropy-index : index file written : '${INDEX_DIR}/${prevEntropyHash}.json' : ${parentCommitId}`);
    }
}
if (parsedArgs["entropy-upload-kv"]) {
    const entropyFile = await readJSON(ENTROPY_FILE);
    if (entropyFile) {
        try {
            await retryAsync(async () => {
                console.log("entropy-upload-kv : PUT");
                const ret = await putKVLatest(entropyFile);
                if (ret?.ok) {
                    console.log(`entropy-upload-kv : success : latest entropy.json file written to Cloudflare KV : ${JSON.stringify(ret.data)}`);
                    const heartbeatUrl = Deno.env.get('BETTER_UPTIME_HEARTBEAT_URL');
                    if (heartbeatUrl) {
                        try {
                            const hb = await get(heartbeatUrl);
                            if (hb.ok) {
                                console.log(`entropy-upload-kv : success : better uptime heartbeat logged`);
                            }
                        }
                        catch (error) {
                            console.error(`better uptime heartbeat failed : ${error.message}`);
                        }
                    }
                }
                else {
                    console.log(`entropy-upload-kv : failed : latest entropy.json file was NOT written to Cloudflare KV : ${JSON.stringify(ret.data)}`);
                }
            }, { delay: 1000, maxTry: 3 });
        }
        catch (error) {
            if (isTooManyTries(error)) {
                console.error(`entropy-upload-kv tooManyTries : ${error.message}`);
            }
            else {
                console.error(`entropy-upload-kv failed : ${error.message}`);
            }
        }
    }
    else {
        console.warn(`entropy-upload-kv : failed : unable to read entropy file`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUE7QUFDMUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVyRixPQUFPLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXJGLE9BQU8sS0FBSyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFL0QsT0FBTyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUV4RixNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUM7QUFDbkMsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO0FBQ3BDLE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQztBQUNoQyxNQUFNLGlCQUFpQixHQUFHLEdBQUcsV0FBVyx3QkFBd0IsQ0FBQztBQUNqRSxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztBQUMxQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFDM0IsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDO0FBQy9CLE1BQU0sVUFBVSxHQUFHLGtDQUFrQyxDQUFDO0FBQ3RELE1BQU0sWUFBWSxHQUFHLGtDQUFrQyxDQUFDO0FBQ3hELE1BQU0sR0FBRyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDdkIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBcUJ6QixLQUFLLFVBQVUsUUFBUSxDQUFDLElBQVk7SUFDbEMsSUFBSTtRQUNGLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlB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SCxDQUFDO29CQUdGLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUE7b0JBQ2hFLElBQUksWUFBWSxFQUFFO3dCQUNoQixJQUFJOzRCQUNGLE1BQU0sRUFBRSxHQUFHLE1BQU0sR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFBOzRCQUNsQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0NBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FDVCw4REFBOEQsQ0FDL0QsQ0FBQzs2QkFDSDt5QkFDRjt3QkFBQyxPQUFPLEtBQUssRUFBRTs0QkFDZCxPQUFPLENBQUMsS0FBSyxDQUFDLG9DQUFvQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQTt5QkFDbkU7cUJBQ0Y7aUJBQ0Y7cUJBQU07b0JBQ0wsT0FBTyxDQUFDLEdBQUcsQ0FDVCw0RkFBNEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDdkgsQ0FBQztpQkFDSDtZQUNILENBQUMsRUFDRCxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUMzQixDQUFDO1NBQ0g7UUFBQyxPQUFPLEtBQUssRUFBRTtZQUNkLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUV6QixPQUFPLENBQUMsS0FBSyxDQUFDLG9DQUFvQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUNwRTtpQkFBTTtnQkFDTCxPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUM5RDtTQUNGO0tBQ0Y7U0FBTTtRQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsMERBQTBELENBQUMsQ0FBQTtLQUN6RTtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC45OC4wL2hhc2gvbW9kLnRzXCI7XG5pbXBvcnQgeyBTdGF0dXMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTI5LjAvaHR0cC9odHRwX3N0YXR1cy50c1wiXG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xMjkuMC9mbGFncy9tb2QudHNcIjtcbmltcG9ydCB7IGVuc3VyZURpclN5bmMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTI5LjAvZnMvbW9kLnRzXCI7XG5pbXBvcnQgeyBhc3NlcnRPYmplY3RNYXRjaCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xMjkuMC90ZXN0aW5nL2Fzc2VydHMudHNcIjtcblxuaW1wb3J0IHsgcmV0cnlBc3luYywgaXNUb29NYW55VHJpZXMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQveC9yZXRyeUB2Mi4wLjAvbW9kLnRzXCI7XG5cbmltcG9ydCAqIGFzIGVkIGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L2VkMjU1MTlAMS42LjAvbW9kLnRzXCI7XG5cbmltcG9ydCBDbGllbnQsIHsgSFRUUCB9IGZyb20gXCJodHRwczovL2Nkbi5qc2RlbGl2ci5uZXQvbnBtL2RyYW5kLWNsaWVudEAwLjIuMC9kcmFuZC5qc1wiO1xuXG5jb25zdCBERU5PX0xPQ0tfRklMRSA9IFwibG9jay5qc29uXCI7XG5jb25zdCBFTlRST1BZX0ZJTEUgPSBcImVudHJvcHkuanNvblwiO1xuY29uc3QgRU5UUk9QWV9ESVIgPSBcIi4vZW50cm9weVwiO1xuY29uc3QgUFJFVl9FTlRST1BZX0ZJTEUgPSBgJHtFTlRST1BZX0RJUn0vZW50cm9weV9wcmV2aW91cy5qc29uYDtcbmNvbnN0IElOREVYX0RJUiA9IFwiaW5kZXgvYnkvZW50cm9weV9oYXNoXCI7XG5jb25zdCBIQVNIX1RZUEUgPSBcInNoYTI1NlwiO1xuY29uc3QgSEFTSF9JVEVSQVRJT05TID0gNTAwMDAwO1xuY29uc3QgU0hBMV9SRUdFWCA9IC9eKD86KDB4KSooW0EtRmEtZjAtOV17Mn0pezIwfSkkL2k7XG5jb25zdCBTSEEyNTZfUkVHRVggPSAvXig/OigweCkqKFtBLUZhLWYwLTldezJ9KXszMn0pJC9pO1xuY29uc3QgTk9XID0gbmV3IERhdGUoKTtcbmNvbnN0IEdFVF9USU1FT1VUID0gNTAwMDtcblxuaW50ZXJmYWNlIEpTT05GaWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBoYXNoPzogc3RyaW5nO1xuICBoYXNoVHlwZT86IHN0cmluZztcbn1cblxudHlwZSBKU09ORmlsZXMgPSBKU09ORmlsZVtdO1xuXG50eXBlIEVudHJvcHkgPSB7XG4gIGZpbGVzOiBKU09ORmlsZXM7XG4gIGhhc2hUeXBlOiBzdHJpbmc7XG4gIGhhc2hJdGVyYXRpb25zOiBudW1iZXI7XG4gIGhhc2g6IHN0cmluZztcbiAgcHJldkhhc2g/OiBzdHJpbmc7XG4gIHNpZ25hdHVyZT86IHN0cmluZztcbiAgY3JlYXRlZEF0Pzogc3RyaW5nO1xufTtcblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmFzeW5jIGZ1bmN0aW9uIHJlYWRKU09OKHBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55IHwgdW5kZWZpbmVkPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IERlbm8ucmVhZFRleHRGaWxlKHBhdGgpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpO1xuICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAvLyBjb25zb2xlLmVycm9yKF9lcnJvcik7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vLyBHRVQgSlNPTiBmcm9tIGEgVVJMIHdpdGggYSB0aW1lb3V0XG4vLyBodHRwczovL21lZGl1bS5jb20vZGVuby10aGUtY29tcGxldGUtcmVmZXJlbmNlL2ZldGNoLXRpbWVvdXQtaW4tZGVuby05MTczMWJjYTgwYTFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXQodXJsOiBzdHJpbmcsIHRpbWVvdXQgPSBHRVRfVElNRU9VVCkge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjb25zdCByZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiBjLmFib3J0KCksIHRpbWVvdXQpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwgeyBzaWduYWw6IGMuc2lnbmFsIH0pO1xuICAgIGNsZWFyVGltZW91dChpZCk7XG4gICAgcmV0Lm9rID0gdHJ1ZTtcbiAgICByZXQuZGF0YSA9IGF3YWl0IHJlcy5qc29uKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChlcnIgaW5zdGFuY2VvZiBET01FeGNlcHRpb24gJiYgZXJyLm5hbWUgPT09ICdBYm9ydEVycm9yJylcbiAgICAgIHJldC5lcnIgPSBTdGF0dXMuUmVxdWVzdFRpbWVvdXQ7XG4gICAgZWxzZVxuICAgICAgcmV0LmVyciA9IFN0YXR1cy5TZXJ2aWNlVW5hdmFpbGFibGU7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cblxuLy8gUFVUIEpTT04gdG8gQ2xvdWRmbGFyZSBLViB3aXRoIGEgdGltZW91dFxuYXN5bmMgZnVuY3Rpb24gcHV0S1ZMYXRlc3QoYm9keTogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgbnVtYmVyPiwgdGltZW91dCA9IEdFVF9USU1FT1VUKSB7XG4gIGNvbnN0IGFjY291bnRJZGVudGlmaWVyID0gRGVuby5lbnYuZ2V0KCdDRl9BQ0NPVU5UX0lEJylcbiAgY29uc3QgbmFtZXNwYWNlSWRlbnRpZmllciA9IERlbm8uZW52LmdldCgnQ0ZfTkFNRVNQQUNFX0lEJylcbiAgY29uc3Qga2V5TmFtZSA9IFwibGF0ZXN0XCJcbiAgY29uc3QgZXhwaXJhdGlvblR0bCA9IDYwICogNlxuICBjb25zdCBhdXRoRW1haWwgPSBEZW5vLmVudi5nZXQoJ0NGX0FVVEhfRU1BSUwnKSB8fCAnJ1xuICBjb25zdCBhdXRoS2V5ID0gRGVuby5lbnYuZ2V0KCdDRl9BVVRIX0tFWScpIHx8ICcnXG4gIGNvbnN0IHVybCA9IGBodHRwczovL2FwaS5jbG91ZGZsYXJlLmNvbS9jbGllbnQvdjQvYWNjb3VudHMvJHthY2NvdW50SWRlbnRpZmllcn0vc3RvcmFnZS9rdi9uYW1lc3BhY2VzLyR7bmFtZXNwYWNlSWRlbnRpZmllcn0vdmFsdWVzLyR7a2V5TmFtZX0/ZXhwaXJhdGlvbl90dGw9JHtleHBpcmF0aW9uVHRsfWBcblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjb25zdCByZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiBjLmFib3J0KCksIHRpbWVvdXQpO1xuXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6IFwiUFVUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiWC1BdXRoLUVtYWlsXCI6IGF1dGhFbWFpbCxcbiAgICAgICAgXCJYLUF1dGgtS2V5XCI6IGF1dGhLZXksXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgc2lnbmFsOiBjLnNpZ25hbFxuICAgIH0pO1xuXG4gICAgY2xlYXJUaW1lb3V0KGlkKTtcbiAgICByZXQub2sgPSB0cnVlO1xuICAgIHJldC5kYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIERPTUV4Y2VwdGlvbiAmJiBlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKVxuICAgICAgcmV0LmVyciA9IFN0YXR1cy5SZXF1ZXN0VGltZW91dDtcbiAgICBlbHNlXG4gICAgICByZXQuZXJyID0gU3RhdHVzLlNlcnZpY2VVbmF2YWlsYWJsZTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG5hc3luYyBmdW5jdGlvbiB3cml0ZUpTT04ocGF0aDogc3RyaW5nLCBkYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikge1xuICBhd2FpdCBEZW5vLndyaXRlVGV4dEZpbGUocGF0aCwgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xufVxuXG5mdW5jdGlvbiBnZXRQcml2YXRlS2V5KCk6IHN0cmluZyB7XG4gIGNvbnN0IHByaXZLZXkgPSBEZW5vLmVudi5nZXQoXCJFRDI1NTE5X1BSSVZBVEVfS0VZXCIpIHx8IFwiXCI7XG4gIGlmICghcHJpdktleSB8fCBwcml2S2V5ID09PSBcIlwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJtaXNzaW5nIHJlcXVpcmVkIGVudmlyb25tZW50IHZhcmlhYmxlIEVEMjU1MTlfUFJJVkFURV9LRVlcIixcbiAgICApO1xuICB9XG4gIHJldHVybiBwcml2S2V5O1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRQdWJsaWNLZXkoKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgcHVibGljS2V5ID0gYXdhaXQgcmV0cnlBc3luYyhcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcInZlcmlmeSA6IHJldHJpZXZlIHB1YmxpYyBrZXlcIik7XG5cbiAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2VudHJvcHkudHJ1ZXN0YW1wLmNvbS9wdWJrZXlcIilcbiAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgZGF0YTogcHVibGljS2V5T2JqIH0gPSByZXNwXG5cbiAgICAgIGNvbnN0IHB1YmxpY0tleSA9IHB1YmxpY0tleU9iaj8ua2V5O1xuICAgICAgaWYgKCFwdWJsaWNLZXkgfHwgcHVibGljS2V5ID09PSBcIlwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcImZhaWxlZCB0byByZXRyaWV2ZSByZXF1aXJlZCBlZDI1NTE5IHB1YmxpYyBrZXkgZnJvbSBodHRwczovL2VudHJvcHkudHJ1ZXN0YW1wLmNvbS9wdWJrZXlcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwdWJsaWNLZXk7XG4gICAgfSxcbiAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgKTtcblxuICByZXR1cm4gcHVibGljS2V5O1xufVxuXG4vLyBGaW5kIGFsbCAqLmpzb24gZmlsZXMgaW4gdGhpcyBkaXIgZm9yIGhhc2hpbmcuXG4vLyBJbmNsdWRlcyB0aGUgcHJldmlvdXMgZW50cm9weSBmaWxlIGJ1dCBub3QgdGhlIGN1cnJlbnQgb25lLlxuY29uc3QgZ2V0RmlsZXMgPSAoKTogSlNPTkZpbGVzID0+IHtcbiAgY29uc3QgZmlsZXM6IEpTT05GaWxlcyA9IFtdO1xuXG4gIC8vIGNvbGxlY3QgdGhlICcuanNvbicgZmlsZXMgZnJvbSBkaXJcbiAgZm9yIChjb25zdCBkaXJFbnRyeSBvZiBEZW5vLnJlYWREaXJTeW5jKEVOVFJPUFlfRElSKSkge1xuICAgIGlmIChcbiAgICAgIGRpckVudHJ5LmlzRmlsZSAmJiBkaXJFbnRyeS5uYW1lLmVuZHNXaXRoKFwiLmpzb25cIilcbiAgICApIHtcbiAgICAgIGZpbGVzLnB1c2goeyBuYW1lOiBkaXJFbnRyeS5uYW1lIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIGNhbGN1bGF0ZSB0aGUgaGFzaCBvZiBlYWNoIGZpbGVcbiAgZmlsZXMubWFwKChmaWxlKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IERlbm8ucmVhZEZpbGVTeW5jKGAke0VOVFJPUFlfRElSfS8ke2ZpbGUubmFtZX1gKTtcbiAgICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaChIQVNIX1RZUEUpO1xuICAgIGhhc2gudXBkYXRlKGRhdGEpO1xuICAgIGZpbGUuaGFzaCA9IGhhc2gudG9TdHJpbmcoKTtcbiAgICBmaWxlLmhhc2hUeXBlID0gSEFTSF9UWVBFO1xuICAgIHJldHVybiBmaWxlO1xuICB9KTtcblxuICAvLyBzb3J0IEFycmF5IG9mIE9iamVjdHMgYnkgZmlsZSBuYW1lIHNvIHRoZSBzb3J0IG9yZGVyIGFuZCByZXN1bHRhbnQgaGFzaCBpcyBkZXRlcm1pbmlzdGljXG4gIGNvbnN0IHNvcnRlZEZpbGVzID0gZmlsZXMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgIGNvbnN0IG5hbWVBID0gYS5uYW1lLnRvVXBwZXJDYXNlKCk7IC8vIGlnbm9yZSB1cHBlciBhbmQgbG93ZXJjYXNlXG4gICAgY29uc3QgbmFtZUIgPSBiLm5hbWUudG9VcHBlckNhc2UoKTsgLy8gaWdub3JlIHVwcGVyIGFuZCBsb3dlcmNhc2VcbiAgICBpZiAobmFtZUEgPCBuYW1lQikge1xuICAgICAgcmV0dXJuIC0xOyAvL25hbWVBIGNvbWVzIGZpcnN0XG4gICAgfVxuICAgIGlmIChuYW1lQSA+IG5hbWVCKSB7XG4gICAgICByZXR1cm4gMTsgLy8gbmFtZUIgY29tZXMgZmlyc3RcbiAgICB9XG4gICAgcmV0dXJuIDA7IC8vIG5hbWVzIG11c3QgYmUgZXF1YWxcbiAgfSk7XG5cbiAgcmV0dXJuIHNvcnRlZEZpbGVzO1xufTtcblxuLy8gY29uY2F0ZW5hdGUgYWxsIG9mIHRoZSBpbmRpdmlkdWFsIGZpbGVzIGhhc2hlcyBpbnRvIG9uZSBsb25nIGhhc2ggc3RyaW5nXG5jb25zdCBjb25jYXRlbmF0ZUZpbGVIYXNoZXMgPSAoZmlsZXM6IEpTT05GaWxlcyk6IHN0cmluZyA9PiB7XG4gIGNvbnN0IGhhc2hlcyA9IFtdO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICBoYXNoZXMucHVzaChmaWxlLmhhc2gpO1xuICB9XG4gIHJldHVybiBoYXNoZXMuam9pbihcIlwiKTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgbmV3IGhhc2ggc2xvd2x5IChuYcOvdmUgdW5pY29ybiBzdHlsZSAnc2xvdGgnIGZ1bmN0aW9uKVxuY29uc3QgZ2VuU2xvd0hhc2ggPSAoaGFzaDogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgbGV0IG5ld0hhc2ggPSBoYXNoO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgSEFTSF9JVEVSQVRJT05TOyBpKyspIHtcbiAgICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaChIQVNIX1RZUEUpO1xuICAgIGhhc2gudXBkYXRlKG5ld0hhc2gpO1xuICAgIG5ld0hhc2ggPSBoYXNoLnRvU3RyaW5nKCk7XG4gIH1cblxuICByZXR1cm4gbmV3SGFzaDtcbn07XG5cbmNvbnN0IGdlbkVudHJvcHkgPSBhc3luYyAoKTogUHJvbWlzZTxFbnRyb3B5PiA9PiB7XG4gIGNvbnN0IGZpbGVzID0gZ2V0RmlsZXMoKTtcbiAgY29uc3QgY29uY2F0ZW5hdGVkRmlsZUhhc2hlcyA9IGNvbmNhdGVuYXRlRmlsZUhhc2hlcyhmaWxlcyk7XG4gIGNvbnN0IHNsb3dIYXNoID0gZ2VuU2xvd0hhc2goY29uY2F0ZW5hdGVkRmlsZUhhc2hlcyk7XG5cbiAgY29uc3QgZW50cm9weTogRW50cm9weSA9IHtcbiAgICBmaWxlczogZmlsZXMsXG4gICAgaGFzaFR5cGU6IEhBU0hfVFlQRSxcbiAgICBoYXNoSXRlcmF0aW9uczogSEFTSF9JVEVSQVRJT05TLFxuICAgIGhhc2g6IHNsb3dIYXNoLFxuICAgIGNyZWF0ZWRBdDogTk9XLnRvSVNPU3RyaW5nKCksXG4gIH07XG5cbiAgbGV0IGhhc2hTaWc7XG4gIGlmIChwYXJzZWRBcmdzW1wiZW50cm9weS1nZW5lcmF0ZVwiXSkge1xuICAgIGhhc2hTaWcgPSBhd2FpdCBlZC5zaWduKGVudHJvcHkuaGFzaCwgZ2V0UHJpdmF0ZUtleSgpKTtcbiAgICBlbnRyb3B5LnNpZ25hdHVyZSA9IGVkLnV0aWxzLmJ5dGVzVG9IZXgoaGFzaFNpZyk7XG4gIH1cblxuICBjb25zdCBwcmV2RW50cm9weSA9IGF3YWl0IHJlYWRKU09OKFBSRVZfRU5UUk9QWV9GSUxFKTtcbiAgZW50cm9weS5wcmV2SGFzaCA9IHByZXZFbnRyb3B5Py5oYXNoO1xuXG4gIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGVudHJvcHksIG51bGwsIDIpKTtcbiAgcmV0dXJuIGVudHJvcHk7XG59O1xuXG4vLyBDTEkgQXJndW1lbnQgSGFuZGxlclxuY29uc3QgcGFyc2VkQXJncyA9IHBhcnNlKERlbm8uYXJncywge1xuICBib29sZWFuOiBbXG4gICAgXCJjbGVhblwiLFxuICAgIFwiY29sbGVjdFwiLFxuICAgIFwiY29sbGVjdC10aW1lc3RhbXBcIixcbiAgICBcImNvbGxlY3QtYml0Y29pblwiLFxuICAgIFwiY29sbGVjdC1ldGhlcmV1bVwiLFxuICAgIFwiY29sbGVjdC1zdGVsbGFyXCIsXG4gICAgXCJjb2xsZWN0LWRyYW5kXCIsXG4gICAgXCJjb2xsZWN0LWhuXCIsXG4gICAgXCJjb2xsZWN0LW5pc3RcIixcbiAgICBcImNvbGxlY3QtdXNlci1lbnRyb3B5XCIsXG4gICAgXCJlbnRyb3B5LWdlbmVyYXRlXCIsXG4gICAgXCJlbnRyb3B5LXZlcmlmeVwiLFxuICAgIFwiZW50cm9weS1pbmRleFwiLFxuICAgIFwiZW50cm9weS11cGxvYWQta3ZcIlxuICBdLFxufSk7XG5cbi8vIENMRUFOVVBcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyAtLWNsZWFuXG5pZiAocGFyc2VkQXJnc1tcImNsZWFuXCJdKSB7XG4gIGNvbnNvbGUubG9nKFwiY2xlYW5cIik7XG4gIC8vIENsZWFudXAgYW55IGNvbGxlY3RlZCAqLmpzb24gZmlsZXMgKGZvciBkZXZlbG9wbWVudClcbiAgZm9yIChjb25zdCBkaXJFbnRyeSBvZiBEZW5vLnJlYWREaXJTeW5jKFwiLlwiKSkge1xuICAgIGlmIChcbiAgICAgIGRpckVudHJ5LmlzRmlsZSAmJiBkaXJFbnRyeS5uYW1lLmVuZHNXaXRoKFwiLmpzb25cIikgJiZcbiAgICAgIGRpckVudHJ5Lm5hbWUgIT09IEVOVFJPUFlfRklMRSAmJlxuICAgICAgZGlyRW50cnkubmFtZSAhPT0gREVOT19MT0NLX0ZJTEVcbiAgICApIHtcbiAgICAgIERlbm8ucmVtb3ZlU3luYyhkaXJFbnRyeS5uYW1lKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRU5UUk9QWSBDT0xMRUNUSU9OXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gRWFjaCBjb2xsZWN0aW9uIHNvdXJjZSB3aWxsIGJlIHJldHJpZWQgb24gZmFpbHVyZSwgYnV0IGlmIGl0XG4vLyBmaW5hbGx5IHN0aWxsIHJhaXNlcyBhbiBlcnJvciBpdCB3aWxsIGp1c3QgYmUgbG9nZ2VkIGFuZCB0aGlzXG4vLyBzb3VyY2Ugd2lsbCBiZSBza2lwcGVkLlxuXG4vLyBUSU1FU1RBTVBcbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC10aW1lc3RhbXBcIl0pIHtcbiAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IHRpbWVzdGFtcFwiKTtcbiAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS90aW1lc3RhbXAuanNvbmAsIHtcbiAgICAgICAgdGltZXN0YW1wOiBOT1cudG9JU09TdHJpbmcoKSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICk7XG59XG5cbi8vIEJJVENPSU5cbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC1iaXRjb2luXCJdKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiBiaXRjb2luXCIpO1xuXG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2Jsb2NrY2hhaW4uaW5mby9sYXRlc3RibG9ja1wiKVxuICAgICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3BcblxuICAgICAgICAvLyBleHRyYWN0IGp1c3QgdGhlIGRhdGEgd2Ugd2FudFxuICAgICAgICBjb25zdCB7IGhlaWdodCwgaGFzaCwgdGltZSwgYmxvY2tfaW5kZXg6IGJsb2NrSW5kZXggfSA9IGRhdGE7XG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L2JpdGNvaW4uanNvbmAsIHtcbiAgICAgICAgICBoZWlnaHQsXG4gICAgICAgICAgaGFzaCxcbiAgICAgICAgICB0aW1lLFxuICAgICAgICAgIGJsb2NrSW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGJpdGNvaW4gdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGJpdGNvaW4gZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBFVEhFUkVVTVxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LWV0aGVyZXVtXCJdKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiBldGhlcmV1bVwiKTtcblxuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9hcGkuYmxvY2tjeXBoZXIuY29tL3YxL2V0aC9tYWluXCIpXG4gICAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YSB9ID0gcmVzcFxuXG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L2V0aGVyZXVtLmpzb25gLCBkYXRhKTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBldGhlcmV1bSB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgZXRoZXJldW0gZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBOSVNUIEJFQUNPTlxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LW5pc3RcIl0pIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IG5pc3QtYmVhY29uXCIpO1xuXG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2JlYWNvbi5uaXN0Lmdvdi9iZWFjb24vMi4wL3B1bHNlL2xhc3RcIilcbiAgICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXNwXG5cbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vbmlzdC1iZWFjb24uanNvbmAsIGRhdGEpO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IG5pc3QtYmVhY29uIHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBuaXN0LWJlYWNvbiBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIFVTRVIgRU5UUk9QWVxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LXVzZXItZW50cm9weVwiXSkge1xuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogdXNlci1lbnRyb3B5XCIpO1xuXG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2VudHJvcHkudHJ1ZXN0YW1wLmNvbS9lbnRyaWVzXCIpXG4gICAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YSB9ID0gcmVzcFxuXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBjb2xsZWN0IGF0dGVtcHQgOiB1c2VyLWVudHJvcHkgOiBleHBlY3RlZCBBcnJheSwgZ290ICR7ZGF0YX1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS91c2VyLWVudHJvcHkuanNvbmAsIHsgZGF0YSB9KTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCB1c2VyLWVudHJvcHkgdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IHVzZXItZW50cm9weSBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIFNURUxMQVJcbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC1zdGVsbGFyXCJdKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiBzdGVsbGFyXCIpO1xuICAgICAgICAvLyBSZXRyaWV2ZSB0aGUgbGFzdCBsZWRnZXIgSUQuXG4gICAgICAgIC8vIGN1cmwgLVggR0VUIFwiaHR0cHM6Ly9ob3Jpem9uLnN0ZWxsYXIub3JnL2ZlZV9zdGF0c1wiID4gc3RlbGxhci1mZWUtc3RhdHMuanNvblxuXG4gICAgICAgIGNvbnN0IHJlc3BTdGF0cyA9IGF3YWl0IGdldChcImh0dHBzOi8vaG9yaXpvbi5zdGVsbGFyLm9yZy9mZWVfc3RhdHNcIilcbiAgICAgICAgaWYgKHJlc3BTdGF0cy5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcFN0YXRzLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YTogZmVlU3RhdHMgfSA9IHJlc3BTdGF0c1xuXG4gICAgICAgIC8vIFJlYWQgdGhlIGxlZGdlciBmb3IgbGFzdCBsZWRnZXIgSURcbiAgICAgICAgY29uc3QgcmVzcExlZGdlciA9IGF3YWl0IGdldChgaHR0cHM6Ly9ob3Jpem9uLnN0ZWxsYXIub3JnL2xlZGdlcnMvJHtmZWVTdGF0cy5sYXN0X2xlZGdlcn1gKVxuICAgICAgICBpZiAocmVzcExlZGdlci5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcExlZGdlci5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGE6IGxhdGVzdExlZGdlciB9ID0gcmVzcExlZGdlclxuXG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L3N0ZWxsYXIuanNvbmAsIGxhdGVzdExlZGdlcik7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3Qgc3RlbGxhciB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3Qgc3RlbGxhciBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIERSQU5EIEJFQUNPTlxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LWRyYW5kXCJdKSB7XG4gIC8vIERyYW5kIEJlYWNvblxuICAvLyBodHRwczovL2RyYW5kLmxvdmUvZGV2ZWxvcGVyL2h0dHAtYXBpLyNwdWJsaWMtZW5kcG9pbnRzXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kcmFuZC9kcmFuZC1jbGllbnRcblxuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogZHJhbmQtYmVhY29uXCIpO1xuICAgICAgICBjb25zdCB1cmxzID0gW1xuICAgICAgICAgIFwiaHR0cHM6Ly9kcmFuZC5jbG91ZGZsYXJlLmNvbVwiLFxuICAgICAgICBdO1xuXG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2RyYW5kLmNsb3VkZmxhcmUuY29tL2luZm9cIilcbiAgICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhOiBjaGFpbkluZm8gfSA9IHJlc3BcblxuICAgICAgICBjb25zdCBvcHRpb25zID0geyBjaGFpbkluZm8gfTtcblxuICAgICAgICBjb25zdCBjbGllbnQgPSBhd2FpdCBDbGllbnQud3JhcChcbiAgICAgICAgICBIVFRQLmZvclVSTHModXJscywgY2hhaW5JbmZvLmhhc2gpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgcmFuZG9tbmVzcyA9IGF3YWl0IGNsaWVudC5nZXQoKTtcblxuICAgICAgICBhd2FpdCBjbGllbnQuY2xvc2UoKTtcblxuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS9kcmFuZC1iZWFjb24uanNvbmAsIHtcbiAgICAgICAgICBjaGFpbkluZm8sXG4gICAgICAgICAgcmFuZG9tbmVzcyxcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgZHJhbmQgdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGRyYW5kIGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gSEFDS0VSIE5FV1NcbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC1oblwiXSkge1xuICAvLyBIYWNrZXIgTmV3cyBBUEk6IGh0dHBzOi8vZ2l0aHViLmNvbS9IYWNrZXJOZXdzL0FQSVxuXG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiBoYWNrZXItbmV3c1wiKTtcblxuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9oYWNrZXItbmV3cy5maXJlYmFzZWlvLmNvbS92MC9uZXdzdG9yaWVzLmpzb25cIilcbiAgICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhOiBuZXdzU3RvcmllcyB9ID0gcmVzcFxuXG4gICAgICAgIGNvbnN0IHN0b3JpZXMgPSBbXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgICBjb25zdCByZXNwU3RvcnkgPSBhd2FpdCBnZXQoYGh0dHBzOi8vaGFja2VyLW5ld3MuZmlyZWJhc2Vpby5jb20vdjAvaXRlbS8ke25ld3NTdG9yaWVzW2ldfS5qc29uYClcbiAgICAgICAgICBpZiAocmVzcFN0b3J5LmVycikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3BTdG9yeS5lcnJ9YCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgeyBkYXRhOiBzdG9yeSB9ID0gcmVzcFN0b3J5XG5cbiAgICAgICAgICBzdG9yaWVzLnB1c2goc3RvcnkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vaGFja2VyLW5ld3MuanNvbmAsIHsgc3RvcmllcyB9KTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBoYWNrZXIgbmV3cyB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgaGFja2VyIG5ld3MgZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBFTlRST1BZIEdFTkVSQVRJT05cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyAtLWVudHJvcHktZ2VuZXJhdGVcbmlmIChwYXJzZWRBcmdzW1wiZW50cm9weS1nZW5lcmF0ZVwiXSkge1xuICAvLyBDb3B5IGV4aXN0aW5nIGVudHJvcHkgZmlsZSB0byBwcmV2IHZlcnNpb25cbiAgaWYgKGF3YWl0IHJlYWRKU09OKEVOVFJPUFlfRklMRSkpIHtcbiAgICBEZW5vLmNvcHlGaWxlU3luYyhFTlRST1BZX0ZJTEUsIFBSRVZfRU5UUk9QWV9GSUxFKTtcbiAgICBjb25zb2xlLmxvZyhgZW50cm9weSA6IGNvcGllZCB0byAnJHtQUkVWX0VOVFJPUFlfRklMRX0nYCk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBhbmQgb3ZlcndyaXRlIGVudHJvcHkgZmlsZVxuICBjb25zdCBlbnRyb3B5ID0gYXdhaXQgZ2VuRW50cm9weSgpO1xuICBhd2FpdCB3cml0ZUpTT04oRU5UUk9QWV9GSUxFLCBlbnRyb3B5KTtcbiAgY29uc29sZS5sb2coXCJlbnRyb3B5IDogZ2VuZXJhdGVkXCIpO1xufVxuXG4vLyAtLWVudHJvcHktdmVyaWZ5XG5pZiAocGFyc2VkQXJnc1tcImVudHJvcHktdmVyaWZ5XCJdKSB7XG4gIC8vIENvbXBhcmUgbmV3bHkgY2FsY3VsYXRlZCByZXN1bHRzIHRvIHdoYXQncyBhbHJlYWR5IGJlZW4gd3JpdHRlbiAoZXhjbHVkaW5nIHRoZSBjcmVhdGVkQXQgcHJvcGVydHkpXG5cbiAgY29uc3QgY3VycmVudEVudHJvcHkgPSBhd2FpdCByZWFkSlNPTihFTlRST1BZX0ZJTEUpO1xuICBpZiAoIWN1cnJlbnRFbnRyb3B5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGByZXF1aXJlZCBmaWxlICcke0VOVFJPUFlfRklMRX0nIG5vdCBmb3VuZGApO1xuICB9XG5cbiAgY29uc3QgcHVibGljS2V5ID0gYXdhaXQgZ2V0UHVibGljS2V5KCk7XG5cbiAgaWYgKCFwdWJsaWNLZXkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ1bmFibGUgdG8gcmV0cmlldmUgcHVibGljIGtleSBmb3IgdmVyaWZpY2F0aW9uXCIpO1xuICB9XG5cbiAgaWYgKFxuICAgICFhd2FpdCBlZC52ZXJpZnkoXG4gICAgICBjdXJyZW50RW50cm9weS5zaWduYXR1cmUsXG4gICAgICBjdXJyZW50RW50cm9weS5oYXNoLFxuICAgICAgcHVibGljS2V5LFxuICAgIClcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiaW52YWxpZCBoYXNoIHNpZ25hdHVyZVwiKTtcbiAgfVxuXG4gIGNvbnN0IGVudHJvcHkgPSBhd2FpdCBnZW5FbnRyb3B5KCk7XG4gIC8vIElnbm9yZSB0aGUgY3JlYXRlZF9hdCBpbiB0aGUgY29tbWl0dGVkIHZzIGN1cnJlbnQgSlNPTiBjb21wYXJpc29uXG4gIC8vIHRoaXMgd2lsbCBhbHdheXMgYmUgZGlmZmVyZW50IGJldHdlZW4gY3JlYXRpb24gYW5kIHZlcmlmaWNhdGlvbi5cbiAgZGVsZXRlIGN1cnJlbnRFbnRyb3B5LmNyZWF0ZWRBdDtcbiAgZGVsZXRlIGVudHJvcHkuY3JlYXRlZEF0O1xuICBhc3NlcnRPYmplY3RNYXRjaChjdXJyZW50RW50cm9weSwgZW50cm9weSk7XG4gIGNvbnNvbGUubG9nKFwiZW50cm9weSA6IHZlcmlmaWVkXCIpO1xufVxuXG4vLyAtLWVudHJvcHktaW5kZXhcbmlmIChwYXJzZWRBcmdzW1wiZW50cm9weS1pbmRleFwiXSkge1xuICBjb25zdCBwYXJlbnRDb21taXRJZCA9IERlbm8uZW52LmdldChcIlBBUkVOVF9DT01NSVRfSURcIikgfHwgXCJcIjtcblxuICBpZiAoIVNIQTFfUkVHRVgudGVzdChwYXJlbnRDb21taXRJZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcImludmFsaWQgUEFSRU5UX0NPTU1JVF9JRCBlbnZpcm9ubWVudCB2YXJpYWJsZSwgbXVzdCBiZSBTSEExIGNvbW1pdCBJRFwiLFxuICAgICk7XG4gIH1cblxuICAvLyBDYW4ndCBpbmRleCB3aXRob3V0IGEgcHJldmlvdXMgZmlsZSB3aGljaCBjb250YWlucyB0aGUgaGFzaCB0byBpbmRleCB0b1xuICBjb25zdCBwcmV2RW50cm9weSA9IGF3YWl0IHJlYWRKU09OKFBSRVZfRU5UUk9QWV9GSUxFKTtcbiAgaWYgKHByZXZFbnRyb3B5KSB7XG4gICAgY29uc3QgcHJldkVudHJvcHlIYXNoID0gcHJldkVudHJvcHk/Lmhhc2g7XG5cbiAgICBpZiAoIXByZXZFbnRyb3B5SGFzaCB8fCAhU0hBMjU2X1JFR0VYLnRlc3QocHJldkVudHJvcHlIYXNoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwibWlzc2luZyBvciBpbnZhbGlkIGVudHJvcHkgaGFzaCBpbiBmaWxlXCIpO1xuICAgIH1cblxuICAgIERlbm8ubWtkaXJTeW5jKElOREVYX0RJUiwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgYXdhaXQgd3JpdGVKU09OKGAke0lOREVYX0RJUn0vJHtwcmV2RW50cm9weUhhc2h9Lmpzb25gLCB7XG4gICAgICBpZDogcGFyZW50Q29tbWl0SWQsXG4gICAgfSk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgZW50cm9weS1pbmRleCA6IGluZGV4IGZpbGUgd3JpdHRlbiA6ICcke0lOREVYX0RJUn0vJHtwcmV2RW50cm9weUhhc2h9Lmpzb24nIDogJHtwYXJlbnRDb21taXRJZH1gLFxuICAgICk7XG4gIH1cbn1cblxuLy8gLS1lbnRyb3B5LXVwbG9hZC1rdlxuaWYgKHBhcnNlZEFyZ3NbXCJlbnRyb3B5LXVwbG9hZC1rdlwiXSkge1xuICBjb25zdCBlbnRyb3B5RmlsZSA9IGF3YWl0IHJlYWRKU09OKEVOVFJPUFlfRklMRSlcblxuICBpZiAoZW50cm9weUZpbGUpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiZW50cm9weS11cGxvYWQta3YgOiBQVVRcIik7XG5cbiAgICAgICAgICBjb25zdCByZXQgPSBhd2FpdCBwdXRLVkxhdGVzdChlbnRyb3B5RmlsZSlcblxuICAgICAgICAgIGlmIChyZXQ/Lm9rKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYGVudHJvcHktdXBsb2FkLWt2IDogc3VjY2VzcyA6IGxhdGVzdCBlbnRyb3B5Lmpzb24gZmlsZSB3cml0dGVuIHRvIENsb3VkZmxhcmUgS1YgOiAke0pTT04uc3RyaW5naWZ5KHJldC5kYXRhKX1gLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gSWYgYSBoZWFydGJlYXQgVVJMIHdhcyBwcm92aWRlZCwgY2FsbCBpdCB3aXRoIHRpbWVvdXRcbiAgICAgICAgICAgIGNvbnN0IGhlYXJ0YmVhdFVybCA9IERlbm8uZW52LmdldCgnQkVUVEVSX1VQVElNRV9IRUFSVEJFQVRfVVJMJylcbiAgICAgICAgICAgIGlmIChoZWFydGJlYXRVcmwpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYiA9IGF3YWl0IGdldChoZWFydGJlYXRVcmwpXG4gICAgICAgICAgICAgICAgaWYgKGhiLm9rKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgYGVudHJvcHktdXBsb2FkLWt2IDogc3VjY2VzcyA6IGJldHRlciB1cHRpbWUgaGVhcnRiZWF0IGxvZ2dlZGAsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBiZXR0ZXIgdXB0aW1lIGhlYXJ0YmVhdCBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYGVudHJvcHktdXBsb2FkLWt2IDogZmFpbGVkIDogbGF0ZXN0IGVudHJvcHkuanNvbiBmaWxlIHdhcyBOT1Qgd3JpdHRlbiB0byBDbG91ZGZsYXJlIEtWIDogJHtKU09OLnN0cmluZ2lmeShyZXQuZGF0YSl9YCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgICAgLy8gRmFpbGVkIHRvIHN1Ym1pdCBlbnRyb3B5LXVwbG9hZC1rdiBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgICBjb25zb2xlLmVycm9yKGBlbnRyb3B5LXVwbG9hZC1rdiB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBlbnRyb3B5LXVwbG9hZC1rdiBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihgZW50cm9weS11cGxvYWQta3YgOiBmYWlsZWQgOiB1bmFibGUgdG8gcmVhZCBlbnRyb3B5IGZpbGVgKVxuICB9XG59XG4iXX0=