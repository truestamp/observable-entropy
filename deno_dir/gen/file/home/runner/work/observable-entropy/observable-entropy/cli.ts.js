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
                            if (hb?.ok) {
                                console.log(`entropy-upload-kv : success : better uptime heartbeat logged`);
                            }
                        }
                        catch (error) {
                            console.error(`better uptime heartbeat failed : ${error.message}`);
                        }
                    }
                    else {
                        console.log(`entropy-upload-kv : better uptime heartbeat not logged : no BETTER_UPTIME_HEARTBEAT_URL provided`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUE7QUFDMUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVyRixPQUFPLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXJGLE9BQU8sS0FBSyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFL0QsT0FBTyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUV4RixNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUM7QUFDbkMsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO0FBQ3BDLE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQztBQUNoQyxNQUFNLGlCQUFpQixHQUFHLEdBQUcsV0FBVyx3QkFBd0IsQ0FBQztBQUNqRSxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztBQUMxQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFDM0IsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDO0FBQy9CLE1BQU0sVUFBVSxHQUFHLGtDQUFrQyxDQUFDO0FBQ3RELE1BQU0sWUFBWSxHQUFHLGtDQUFrQyxDQUFDO0FBQ3hELE1BQU0sR0FBRyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDdkIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBcUJ6QixLQUFLLFVBQVUsUUFBUSxDQUFDLElBQVk7SUFDbEMsSUFBSTtRQUNGLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlB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Imh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjk4LjAvaGFzaC9tb2QudHNcIjtcbmltcG9ydCB7IFN0YXR1cyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xMjkuMC9odHRwL2h0dHBfc3RhdHVzLnRzXCJcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL2ZsYWdzL21vZC50c1wiO1xuaW1wb3J0IHsgZW5zdXJlRGlyU3luYyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xMjkuMC9mcy9tb2QudHNcIjtcbmltcG9ydCB7IGFzc2VydE9iamVjdE1hdGNoIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL3Rlc3RpbmcvYXNzZXJ0cy50c1wiO1xuXG5pbXBvcnQgeyByZXRyeUFzeW5jLCBpc1Rvb01hbnlUcmllcyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L3JldHJ5QHYyLjAuMC9tb2QudHNcIjtcblxuaW1wb3J0ICogYXMgZWQgZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvZWQyNTUxOUAxLjYuMC9tb2QudHNcIjtcblxuaW1wb3J0IENsaWVudCwgeyBIVFRQIH0gZnJvbSBcImh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vZHJhbmQtY2xpZW50QDAuMi4wL2RyYW5kLmpzXCI7XG5cbmNvbnN0IERFTk9fTE9DS19GSUxFID0gXCJsb2NrLmpzb25cIjtcbmNvbnN0IEVOVFJPUFlfRklMRSA9IFwiZW50cm9weS5qc29uXCI7XG5jb25zdCBFTlRST1BZX0RJUiA9IFwiLi9lbnRyb3B5XCI7XG5jb25zdCBQUkVWX0VOVFJPUFlfRklMRSA9IGAke0VOVFJPUFlfRElSfS9lbnRyb3B5X3ByZXZpb3VzLmpzb25gO1xuY29uc3QgSU5ERVhfRElSID0gXCJpbmRleC9ieS9lbnRyb3B5X2hhc2hcIjtcbmNvbnN0IEhBU0hfVFlQRSA9IFwic2hhMjU2XCI7XG5jb25zdCBIQVNIX0lURVJBVElPTlMgPSA1MDAwMDA7XG5jb25zdCBTSEExX1JFR0VYID0gL14oPzooMHgpKihbQS1GYS1mMC05XXsyfSl7MjB9KSQvaTtcbmNvbnN0IFNIQTI1Nl9SRUdFWCA9IC9eKD86KDB4KSooW0EtRmEtZjAtOV17Mn0pezMyfSkkL2k7XG5jb25zdCBOT1cgPSBuZXcgRGF0ZSgpO1xuY29uc3QgR0VUX1RJTUVPVVQgPSA1MDAwO1xuXG5pbnRlcmZhY2UgSlNPTkZpbGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIGhhc2g/OiBzdHJpbmc7XG4gIGhhc2hUeXBlPzogc3RyaW5nO1xufVxuXG50eXBlIEpTT05GaWxlcyA9IEpTT05GaWxlW107XG5cbnR5cGUgRW50cm9weSA9IHtcbiAgZmlsZXM6IEpTT05GaWxlcztcbiAgaGFzaFR5cGU6IHN0cmluZztcbiAgaGFzaEl0ZXJhdGlvbnM6IG51bWJlcjtcbiAgaGFzaDogc3RyaW5nO1xuICBwcmV2SGFzaD86IHN0cmluZztcbiAgc2lnbmF0dXJlPzogc3RyaW5nO1xuICBjcmVhdGVkQXQ/OiBzdHJpbmc7XG59O1xuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuYXN5bmMgZnVuY3Rpb24gcmVhZEpTT04ocGF0aDogc3RyaW5nKTogUHJvbWlzZTxhbnkgfCB1bmRlZmluZWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgRGVuby5yZWFkVGV4dEZpbGUocGF0aCk7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCk7XG4gIH0gY2F0Y2ggKF9lcnJvcikge1xuICAgIC8vIGNvbnNvbGUuZXJyb3IoX2Vycm9yKTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8vIEdFVCBKU09OIGZyb20gYSBVUkwgd2l0aCBhIHRpbWVvdXRcbi8vIGh0dHBzOi8vbWVkaXVtLmNvbS9kZW5vLXRoZS1jb21wbGV0ZS1yZWZlcmVuY2UvZmV0Y2gtdGltZW91dC1pbi1kZW5vLTkxNzMxYmNhODBhMVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldCh1cmw6IHN0cmluZywgdGltZW91dCA9IEdFVF9USU1FT1VUKSB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IHJldDogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IGMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IGMuYWJvcnQoKSwgdGltZW91dCk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7IHNpZ25hbDogYy5zaWduYWwgfSk7XG4gICAgY2xlYXJUaW1lb3V0KGlkKTtcbiAgICByZXQub2sgPSB0cnVlO1xuICAgIHJldC5kYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIERPTUV4Y2VwdGlvbiAmJiBlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKVxuICAgICAgcmV0LmVyciA9IFN0YXR1cy5SZXF1ZXN0VGltZW91dDtcbiAgICBlbHNlXG4gICAgICByZXQuZXJyID0gU3RhdHVzLlNlcnZpY2VVbmF2YWlsYWJsZTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vLyBQVVQgSlNPTiB0byBDbG91ZGZsYXJlIEtWIHdpdGggYSB0aW1lb3V0XG5hc3luYyBmdW5jdGlvbiBwdXRLVkxhdGVzdChib2R5OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBudW1iZXI+LCB0aW1lb3V0ID0gR0VUX1RJTUVPVVQpIHtcbiAgY29uc3QgYWNjb3VudElkZW50aWZpZXIgPSBEZW5vLmVudi5nZXQoJ0NGX0FDQ09VTlRfSUQnKVxuICBjb25zdCBuYW1lc3BhY2VJZGVudGlmaWVyID0gRGVuby5lbnYuZ2V0KCdDRl9OQU1FU1BBQ0VfSUQnKVxuICBjb25zdCBrZXlOYW1lID0gXCJsYXRlc3RcIlxuICBjb25zdCBleHBpcmF0aW9uVHRsID0gNjAgKiA2XG4gIGNvbnN0IGF1dGhFbWFpbCA9IERlbm8uZW52LmdldCgnQ0ZfQVVUSF9FTUFJTCcpIHx8ICcnXG4gIGNvbnN0IGF1dGhLZXkgPSBEZW5vLmVudi5nZXQoJ0NGX0FVVEhfS0VZJykgfHwgJydcbiAgY29uc3QgdXJsID0gYGh0dHBzOi8vYXBpLmNsb3VkZmxhcmUuY29tL2NsaWVudC92NC9hY2NvdW50cy8ke2FjY291bnRJZGVudGlmaWVyfS9zdG9yYWdlL2t2L25hbWVzcGFjZXMvJHtuYW1lc3BhY2VJZGVudGlmaWVyfS92YWx1ZXMvJHtrZXlOYW1lfT9leHBpcmF0aW9uX3R0bD0ke2V4cGlyYXRpb25UdGx9YFxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IHJldDogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICB0cnkge1xuICAgIGNvbnN0IGMgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IGMuYWJvcnQoKSwgdGltZW91dCk7XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogXCJQVVRcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJYLUF1dGgtRW1haWxcIjogYXV0aEVtYWlsLFxuICAgICAgICBcIlgtQXV0aC1LZXlcIjogYXV0aEtleSxcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICBzaWduYWw6IGMuc2lnbmFsXG4gICAgfSk7XG5cbiAgICBjbGVhclRpbWVvdXQoaWQpO1xuICAgIHJldC5vayA9IHRydWU7XG4gICAgcmV0LmRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uICYmIGVyci5uYW1lID09PSAnQWJvcnRFcnJvcicpXG4gICAgICByZXQuZXJyID0gU3RhdHVzLlJlcXVlc3RUaW1lb3V0O1xuICAgIGVsc2VcbiAgICAgIHJldC5lcnIgPSBTdGF0dXMuU2VydmljZVVuYXZhaWxhYmxlO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlSlNPTihwYXRoOiBzdHJpbmcsIGRhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB7XG4gIGF3YWl0IERlbm8ud3JpdGVUZXh0RmlsZShwYXRoLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XG59XG5cbmZ1bmN0aW9uIGdldFByaXZhdGVLZXkoKTogc3RyaW5nIHtcbiAgY29uc3QgcHJpdktleSA9IERlbm8uZW52LmdldChcIkVEMjU1MTlfUFJJVkFURV9LRVlcIikgfHwgXCJcIjtcbiAgaWYgKCFwcml2S2V5IHx8IHByaXZLZXkgPT09IFwiXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIm1pc3NpbmcgcmVxdWlyZWQgZW52aXJvbm1lbnQgdmFyaWFibGUgRUQyNTUxOV9QUklWQVRFX0tFWVwiLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIHByaXZLZXk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFB1YmxpY0tleSgpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCBwdWJsaWNLZXkgPSBhd2FpdCByZXRyeUFzeW5jKFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwidmVyaWZ5IDogcmV0cmlldmUgcHVibGljIGtleVwiKTtcblxuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vZW50cm9weS50cnVlc3RhbXAuY29tL3B1YmtleVwiKVxuICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBkYXRhOiBwdWJsaWNLZXlPYmogfSA9IHJlc3BcblxuICAgICAgY29uc3QgcHVibGljS2V5ID0gcHVibGljS2V5T2JqPy5rZXk7XG4gICAgICBpZiAoIXB1YmxpY0tleSB8fCBwdWJsaWNLZXkgPT09IFwiXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiZmFpbGVkIHRvIHJldHJpZXZlIHJlcXVpcmVkIGVkMjU1MTkgcHVibGljIGtleSBmcm9tIGh0dHBzOi8vZW50cm9weS50cnVlc3RhbXAuY29tL3B1YmtleVwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHB1YmxpY0tleTtcbiAgICB9LFxuICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICApO1xuXG4gIHJldHVybiBwdWJsaWNLZXk7XG59XG5cbi8vIEZpbmQgYWxsICouanNvbiBmaWxlcyBpbiB0aGlzIGRpciBmb3IgaGFzaGluZy5cbi8vIEluY2x1ZGVzIHRoZSBwcmV2aW91cyBlbnRyb3B5IGZpbGUgYnV0IG5vdCB0aGUgY3VycmVudCBvbmUuXG5jb25zdCBnZXRGaWxlcyA9ICgpOiBKU09ORmlsZXMgPT4ge1xuICBjb25zdCBmaWxlczogSlNPTkZpbGVzID0gW107XG5cbiAgLy8gY29sbGVjdCB0aGUgJy5qc29uJyBmaWxlcyBmcm9tIGRpclxuICBmb3IgKGNvbnN0IGRpckVudHJ5IG9mIERlbm8ucmVhZERpclN5bmMoRU5UUk9QWV9ESVIpKSB7XG4gICAgaWYgKFxuICAgICAgZGlyRW50cnkuaXNGaWxlICYmIGRpckVudHJ5Lm5hbWUuZW5kc1dpdGgoXCIuanNvblwiKVxuICAgICkge1xuICAgICAgZmlsZXMucHVzaCh7IG5hbWU6IGRpckVudHJ5Lm5hbWUgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsY3VsYXRlIHRoZSBoYXNoIG9mIGVhY2ggZmlsZVxuICBmaWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICBjb25zdCBkYXRhID0gRGVuby5yZWFkRmlsZVN5bmMoYCR7RU5UUk9QWV9ESVJ9LyR7ZmlsZS5uYW1lfWApO1xuICAgIGNvbnN0IGhhc2ggPSBjcmVhdGVIYXNoKEhBU0hfVFlQRSk7XG4gICAgaGFzaC51cGRhdGUoZGF0YSk7XG4gICAgZmlsZS5oYXNoID0gaGFzaC50b1N0cmluZygpO1xuICAgIGZpbGUuaGFzaFR5cGUgPSBIQVNIX1RZUEU7XG4gICAgcmV0dXJuIGZpbGU7XG4gIH0pO1xuXG4gIC8vIHNvcnQgQXJyYXkgb2YgT2JqZWN0cyBieSBmaWxlIG5hbWUgc28gdGhlIHNvcnQgb3JkZXIgYW5kIHJlc3VsdGFudCBoYXNoIGlzIGRldGVybWluaXN0aWNcbiAgY29uc3Qgc29ydGVkRmlsZXMgPSBmaWxlcy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgY29uc3QgbmFtZUEgPSBhLm5hbWUudG9VcHBlckNhc2UoKTsgLy8gaWdub3JlIHVwcGVyIGFuZCBsb3dlcmNhc2VcbiAgICBjb25zdCBuYW1lQiA9IGIubmFtZS50b1VwcGVyQ2FzZSgpOyAvLyBpZ25vcmUgdXBwZXIgYW5kIGxvd2VyY2FzZVxuICAgIGlmIChuYW1lQSA8IG5hbWVCKSB7XG4gICAgICByZXR1cm4gLTE7IC8vbmFtZUEgY29tZXMgZmlyc3RcbiAgICB9XG4gICAgaWYgKG5hbWVBID4gbmFtZUIpIHtcbiAgICAgIHJldHVybiAxOyAvLyBuYW1lQiBjb21lcyBmaXJzdFxuICAgIH1cbiAgICByZXR1cm4gMDsgLy8gbmFtZXMgbXVzdCBiZSBlcXVhbFxuICB9KTtcblxuICByZXR1cm4gc29ydGVkRmlsZXM7XG59O1xuXG4vLyBjb25jYXRlbmF0ZSBhbGwgb2YgdGhlIGluZGl2aWR1YWwgZmlsZXMgaGFzaGVzIGludG8gb25lIGxvbmcgaGFzaCBzdHJpbmdcbmNvbnN0IGNvbmNhdGVuYXRlRmlsZUhhc2hlcyA9IChmaWxlczogSlNPTkZpbGVzKTogc3RyaW5nID0+IHtcbiAgY29uc3QgaGFzaGVzID0gW107XG4gIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgIGhhc2hlcy5wdXNoKGZpbGUuaGFzaCk7XG4gIH1cbiAgcmV0dXJuIGhhc2hlcy5qb2luKFwiXCIpO1xufTtcblxuLy8gZ2VuZXJhdGUgYSBuZXcgaGFzaCBzbG93bHkgKG5hw692ZSB1bmljb3JuIHN0eWxlICdzbG90aCcgZnVuY3Rpb24pXG5jb25zdCBnZW5TbG93SGFzaCA9IChoYXNoOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBsZXQgbmV3SGFzaCA9IGhhc2g7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBIQVNIX0lURVJBVElPTlM7IGkrKykge1xuICAgIGNvbnN0IGhhc2ggPSBjcmVhdGVIYXNoKEhBU0hfVFlQRSk7XG4gICAgaGFzaC51cGRhdGUobmV3SGFzaCk7XG4gICAgbmV3SGFzaCA9IGhhc2gudG9TdHJpbmcoKTtcbiAgfVxuXG4gIHJldHVybiBuZXdIYXNoO1xufTtcblxuY29uc3QgZ2VuRW50cm9weSA9IGFzeW5jICgpOiBQcm9taXNlPEVudHJvcHk+ID0+IHtcbiAgY29uc3QgZmlsZXMgPSBnZXRGaWxlcygpO1xuICBjb25zdCBjb25jYXRlbmF0ZWRGaWxlSGFzaGVzID0gY29uY2F0ZW5hdGVGaWxlSGFzaGVzKGZpbGVzKTtcbiAgY29uc3Qgc2xvd0hhc2ggPSBnZW5TbG93SGFzaChjb25jYXRlbmF0ZWRGaWxlSGFzaGVzKTtcblxuICBjb25zdCBlbnRyb3B5OiBFbnRyb3B5ID0ge1xuICAgIGZpbGVzOiBmaWxlcyxcbiAgICBoYXNoVHlwZTogSEFTSF9UWVBFLFxuICAgIGhhc2hJdGVyYXRpb25zOiBIQVNIX0lURVJBVElPTlMsXG4gICAgaGFzaDogc2xvd0hhc2gsXG4gICAgY3JlYXRlZEF0OiBOT1cudG9JU09TdHJpbmcoKSxcbiAgfTtcblxuICBsZXQgaGFzaFNpZztcbiAgaWYgKHBhcnNlZEFyZ3NbXCJlbnRyb3B5LWdlbmVyYXRlXCJdKSB7XG4gICAgaGFzaFNpZyA9IGF3YWl0IGVkLnNpZ24oZW50cm9weS5oYXNoLCBnZXRQcml2YXRlS2V5KCkpO1xuICAgIGVudHJvcHkuc2lnbmF0dXJlID0gZWQudXRpbHMuYnl0ZXNUb0hleChoYXNoU2lnKTtcbiAgfVxuXG4gIGNvbnN0IHByZXZFbnRyb3B5ID0gYXdhaXQgcmVhZEpTT04oUFJFVl9FTlRST1BZX0ZJTEUpO1xuICBlbnRyb3B5LnByZXZIYXNoID0gcHJldkVudHJvcHk/Lmhhc2g7XG5cbiAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoZW50cm9weSwgbnVsbCwgMikpO1xuICByZXR1cm4gZW50cm9weTtcbn07XG5cbi8vIENMSSBBcmd1bWVudCBIYW5kbGVyXG5jb25zdCBwYXJzZWRBcmdzID0gcGFyc2UoRGVuby5hcmdzLCB7XG4gIGJvb2xlYW46IFtcbiAgICBcImNsZWFuXCIsXG4gICAgXCJjb2xsZWN0XCIsXG4gICAgXCJjb2xsZWN0LXRpbWVzdGFtcFwiLFxuICAgIFwiY29sbGVjdC1iaXRjb2luXCIsXG4gICAgXCJjb2xsZWN0LWV0aGVyZXVtXCIsXG4gICAgXCJjb2xsZWN0LXN0ZWxsYXJcIixcbiAgICBcImNvbGxlY3QtZHJhbmRcIixcbiAgICBcImNvbGxlY3QtaG5cIixcbiAgICBcImNvbGxlY3QtbmlzdFwiLFxuICAgIFwiY29sbGVjdC11c2VyLWVudHJvcHlcIixcbiAgICBcImVudHJvcHktZ2VuZXJhdGVcIixcbiAgICBcImVudHJvcHktdmVyaWZ5XCIsXG4gICAgXCJlbnRyb3B5LWluZGV4XCIsXG4gICAgXCJlbnRyb3B5LXVwbG9hZC1rdlwiXG4gIF0sXG59KTtcblxuLy8gQ0xFQU5VUFxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIC0tY2xlYW5cbmlmIChwYXJzZWRBcmdzW1wiY2xlYW5cIl0pIHtcbiAgY29uc29sZS5sb2coXCJjbGVhblwiKTtcbiAgLy8gQ2xlYW51cCBhbnkgY29sbGVjdGVkICouanNvbiBmaWxlcyAoZm9yIGRldmVsb3BtZW50KVxuICBmb3IgKGNvbnN0IGRpckVudHJ5IG9mIERlbm8ucmVhZERpclN5bmMoXCIuXCIpKSB7XG4gICAgaWYgKFxuICAgICAgZGlyRW50cnkuaXNGaWxlICYmIGRpckVudHJ5Lm5hbWUuZW5kc1dpdGgoXCIuanNvblwiKSAmJlxuICAgICAgZGlyRW50cnkubmFtZSAhPT0gRU5UUk9QWV9GSUxFICYmXG4gICAgICBkaXJFbnRyeS5uYW1lICE9PSBERU5PX0xPQ0tfRklMRVxuICAgICkge1xuICAgICAgRGVuby5yZW1vdmVTeW5jKGRpckVudHJ5Lm5hbWUpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBFTlRST1BZIENPTExFQ1RJT05cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyBFYWNoIGNvbGxlY3Rpb24gc291cmNlIHdpbGwgYmUgcmV0cmllZCBvbiBmYWlsdXJlLCBidXQgaWYgaXRcbi8vIGZpbmFsbHkgc3RpbGwgcmFpc2VzIGFuIGVycm9yIGl0IHdpbGwganVzdCBiZSBsb2dnZWQgYW5kIHRoaXNcbi8vIHNvdXJjZSB3aWxsIGJlIHNraXBwZWQuXG5cbi8vIFRJTUVTVEFNUFxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LXRpbWVzdGFtcFwiXSkge1xuICBhd2FpdCByZXRyeUFzeW5jKFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogdGltZXN0YW1wXCIpO1xuICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L3RpbWVzdGFtcC5qc29uYCwge1xuICAgICAgICB0aW1lc3RhbXA6IE5PVy50b0lTT1N0cmluZygpLFxuICAgICAgfSk7XG4gICAgfSxcbiAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgKTtcbn1cblxuLy8gQklUQ09JTlxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LWJpdGNvaW5cIl0pIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IGJpdGNvaW5cIik7XG5cbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vYmxvY2tjaGFpbi5pbmZvL2xhdGVzdGJsb2NrXCIpXG4gICAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YSB9ID0gcmVzcFxuXG4gICAgICAgIC8vIGV4dHJhY3QganVzdCB0aGUgZGF0YSB3ZSB3YW50XG4gICAgICAgIGNvbnN0IHsgaGVpZ2h0LCBoYXNoLCB0aW1lLCBibG9ja19pbmRleDogYmxvY2tJbmRleCB9ID0gZGF0YTtcbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vYml0Y29pbi5qc29uYCwge1xuICAgICAgICAgIGhlaWdodCxcbiAgICAgICAgICBoYXNoLFxuICAgICAgICAgIHRpbWUsXG4gICAgICAgICAgYmxvY2tJbmRleCxcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgYml0Y29pbiB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgYml0Y29pbiBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIEVUSEVSRVVNXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtZXRoZXJldW1cIl0pIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IGV0aGVyZXVtXCIpO1xuXG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2FwaS5ibG9ja2N5cGhlci5jb20vdjEvZXRoL21haW5cIilcbiAgICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXNwXG5cbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vZXRoZXJldW0uanNvbmAsIGRhdGEpO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGV0aGVyZXVtIHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBldGhlcmV1bSBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIE5JU1QgQkVBQ09OXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtbmlzdFwiXSkge1xuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogbmlzdC1iZWFjb25cIik7XG5cbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vYmVhY29uLm5pc3QuZ292L2JlYWNvbi8yLjAvcHVsc2UvbGFzdFwiKVxuICAgICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3BcblxuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS9uaXN0LWJlYWNvbi5qc29uYCwgZGF0YSk7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgbmlzdC1iZWFjb24gdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IG5pc3QtYmVhY29uIGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gVVNFUiBFTlRST1BZXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtdXNlci1lbnRyb3B5XCJdKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiB1c2VyLWVudHJvcHlcIik7XG5cbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vZW50cm9weS50cnVlc3RhbXAuY29tL2VudHJpZXNcIilcbiAgICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXNwXG5cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYGNvbGxlY3QgYXR0ZW1wdCA6IHVzZXItZW50cm9weSA6IGV4cGVjdGVkIEFycmF5LCBnb3QgJHtkYXRhfWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L3VzZXItZW50cm9weS5qc29uYCwgeyBkYXRhIH0pO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IHVzZXItZW50cm9weSB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgdXNlci1lbnRyb3B5IGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gU1RFTExBUlxuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LXN0ZWxsYXJcIl0pIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IHN0ZWxsYXJcIik7XG4gICAgICAgIC8vIFJldHJpZXZlIHRoZSBsYXN0IGxlZGdlciBJRC5cbiAgICAgICAgLy8gY3VybCAtWCBHRVQgXCJodHRwczovL2hvcml6b24uc3RlbGxhci5vcmcvZmVlX3N0YXRzXCIgPiBzdGVsbGFyLWZlZS1zdGF0cy5qc29uXG5cbiAgICAgICAgY29uc3QgcmVzcFN0YXRzID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9ob3Jpem9uLnN0ZWxsYXIub3JnL2ZlZV9zdGF0c1wiKVxuICAgICAgICBpZiAocmVzcFN0YXRzLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwU3RhdHMuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhOiBmZWVTdGF0cyB9ID0gcmVzcFN0YXRzXG5cbiAgICAgICAgLy8gUmVhZCB0aGUgbGVkZ2VyIGZvciBsYXN0IGxlZGdlciBJRFxuICAgICAgICBjb25zdCByZXNwTGVkZ2VyID0gYXdhaXQgZ2V0KGBodHRwczovL2hvcml6b24uc3RlbGxhci5vcmcvbGVkZ2Vycy8ke2ZlZVN0YXRzLmxhc3RfbGVkZ2VyfWApXG4gICAgICAgIGlmIChyZXNwTGVkZ2VyLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwTGVkZ2VyLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YTogbGF0ZXN0TGVkZ2VyIH0gPSByZXNwTGVkZ2VyXG5cbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vc3RlbGxhci5qc29uYCwgbGF0ZXN0TGVkZ2VyKTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBzdGVsbGFyIHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBzdGVsbGFyIGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRFJBTkQgQkVBQ09OXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtZHJhbmRcIl0pIHtcbiAgLy8gRHJhbmQgQmVhY29uXG4gIC8vIGh0dHBzOi8vZHJhbmQubG92ZS9kZXZlbG9wZXIvaHR0cC1hcGkvI3B1YmxpYy1lbmRwb2ludHNcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2RyYW5kL2RyYW5kLWNsaWVudFxuXG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiBkcmFuZC1iZWFjb25cIik7XG4gICAgICAgIGNvbnN0IHVybHMgPSBbXG4gICAgICAgICAgXCJodHRwczovL2RyYW5kLmNsb3VkZmxhcmUuY29tXCIsXG4gICAgICAgIF07XG5cbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vZHJhbmQuY2xvdWRmbGFyZS5jb20vaW5mb1wiKVxuICAgICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGE6IGNoYWluSW5mbyB9ID0gcmVzcFxuXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7IGNoYWluSW5mbyB9O1xuXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IENsaWVudC53cmFwKFxuICAgICAgICAgIEhUVFAuZm9yVVJMcyh1cmxzLCBjaGFpbkluZm8uaGFzaCksXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCByYW5kb21uZXNzID0gYXdhaXQgY2xpZW50LmdldCgpO1xuXG4gICAgICAgIGF3YWl0IGNsaWVudC5jbG9zZSgpO1xuXG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L2RyYW5kLWJlYWNvbi5qc29uYCwge1xuICAgICAgICAgIGNoYWluSW5mbyxcbiAgICAgICAgICByYW5kb21uZXNzLFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBkcmFuZCB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgZHJhbmQgZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBIQUNLRVIgTkVXU1xuaWYgKHBhcnNlZEFyZ3NbXCJjb2xsZWN0XCJdIHx8IHBhcnNlZEFyZ3NbXCJjb2xsZWN0LWhuXCJdKSB7XG4gIC8vIEhhY2tlciBOZXdzIEFQSTogaHR0cHM6Ly9naXRodWIuY29tL0hhY2tlck5ld3MvQVBJXG5cbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IGhhY2tlci1uZXdzXCIpO1xuXG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBnZXQoXCJodHRwczovL2hhY2tlci1uZXdzLmZpcmViYXNlaW8uY29tL3YwL25ld3N0b3JpZXMuanNvblwiKVxuICAgICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGE6IG5ld3NTdG9yaWVzIH0gPSByZXNwXG5cbiAgICAgICAgY29uc3Qgc3RvcmllcyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgICAgIGNvbnN0IHJlc3BTdG9yeSA9IGF3YWl0IGdldChgaHR0cHM6Ly9oYWNrZXItbmV3cy5maXJlYmFzZWlvLmNvbS92MC9pdGVtLyR7bmV3c1N0b3JpZXNbaV19Lmpzb25gKVxuICAgICAgICAgIGlmIChyZXNwU3RvcnkuZXJyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcFN0b3J5LmVycn1gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCB7IGRhdGE6IHN0b3J5IH0gPSByZXNwU3RvcnlcblxuICAgICAgICAgIHN0b3JpZXMucHVzaChzdG9yeSk7XG4gICAgICAgIH1cblxuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS9oYWNrZXItbmV3cy5qc29uYCwgeyBzdG9yaWVzIH0pO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGhhY2tlciBuZXdzIHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBoYWNrZXIgbmV3cyBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIEVOVFJPUFkgR0VORVJBVElPTlxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIC0tZW50cm9weS1nZW5lcmF0ZVxuaWYgKHBhcnNlZEFyZ3NbXCJlbnRyb3B5LWdlbmVyYXRlXCJdKSB7XG4gIC8vIENvcHkgZXhpc3RpbmcgZW50cm9weSBmaWxlIHRvIHByZXYgdmVyc2lvblxuICBpZiAoYXdhaXQgcmVhZEpTT04oRU5UUk9QWV9GSUxFKSkge1xuICAgIERlbm8uY29weUZpbGVTeW5jKEVOVFJPUFlfRklMRSwgUFJFVl9FTlRST1BZX0ZJTEUpO1xuICAgIGNvbnNvbGUubG9nKGBlbnRyb3B5IDogY29waWVkIHRvICcke1BSRVZfRU5UUk9QWV9GSUxFfSdgKTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGFuZCBvdmVyd3JpdGUgZW50cm9weSBmaWxlXG4gIGNvbnN0IGVudHJvcHkgPSBhd2FpdCBnZW5FbnRyb3B5KCk7XG4gIGF3YWl0IHdyaXRlSlNPTihFTlRST1BZX0ZJTEUsIGVudHJvcHkpO1xuICBjb25zb2xlLmxvZyhcImVudHJvcHkgOiBnZW5lcmF0ZWRcIik7XG59XG5cbi8vIC0tZW50cm9weS12ZXJpZnlcbmlmIChwYXJzZWRBcmdzW1wiZW50cm9weS12ZXJpZnlcIl0pIHtcbiAgLy8gQ29tcGFyZSBuZXdseSBjYWxjdWxhdGVkIHJlc3VsdHMgdG8gd2hhdCdzIGFscmVhZHkgYmVlbiB3cml0dGVuIChleGNsdWRpbmcgdGhlIGNyZWF0ZWRBdCBwcm9wZXJ0eSlcblxuICBjb25zdCBjdXJyZW50RW50cm9weSA9IGF3YWl0IHJlYWRKU09OKEVOVFJPUFlfRklMRSk7XG4gIGlmICghY3VycmVudEVudHJvcHkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHJlcXVpcmVkIGZpbGUgJyR7RU5UUk9QWV9GSUxFfScgbm90IGZvdW5kYCk7XG4gIH1cblxuICBjb25zdCBwdWJsaWNLZXkgPSBhd2FpdCBnZXRQdWJsaWNLZXkoKTtcblxuICBpZiAoIXB1YmxpY0tleSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcInVuYWJsZSB0byByZXRyaWV2ZSBwdWJsaWMga2V5IGZvciB2ZXJpZmljYXRpb25cIik7XG4gIH1cblxuICBpZiAoXG4gICAgIWF3YWl0IGVkLnZlcmlmeShcbiAgICAgIGN1cnJlbnRFbnRyb3B5LnNpZ25hdHVyZSxcbiAgICAgIGN1cnJlbnRFbnRyb3B5Lmhhc2gsXG4gICAgICBwdWJsaWNLZXksXG4gICAgKVxuICApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIGhhc2ggc2lnbmF0dXJlXCIpO1xuICB9XG5cbiAgY29uc3QgZW50cm9weSA9IGF3YWl0IGdlbkVudHJvcHkoKTtcbiAgLy8gSWdub3JlIHRoZSBjcmVhdGVkX2F0IGluIHRoZSBjb21taXR0ZWQgdnMgY3VycmVudCBKU09OIGNvbXBhcmlzb25cbiAgLy8gdGhpcyB3aWxsIGFsd2F5cyBiZSBkaWZmZXJlbnQgYmV0d2VlbiBjcmVhdGlvbiBhbmQgdmVyaWZpY2F0aW9uLlxuICBkZWxldGUgY3VycmVudEVudHJvcHkuY3JlYXRlZEF0O1xuICBkZWxldGUgZW50cm9weS5jcmVhdGVkQXQ7XG4gIGFzc2VydE9iamVjdE1hdGNoKGN1cnJlbnRFbnRyb3B5LCBlbnRyb3B5KTtcbiAgY29uc29sZS5sb2coXCJlbnRyb3B5IDogdmVyaWZpZWRcIik7XG59XG5cbi8vIC0tZW50cm9weS1pbmRleFxuaWYgKHBhcnNlZEFyZ3NbXCJlbnRyb3B5LWluZGV4XCJdKSB7XG4gIGNvbnN0IHBhcmVudENvbW1pdElkID0gRGVuby5lbnYuZ2V0KFwiUEFSRU5UX0NPTU1JVF9JRFwiKSB8fCBcIlwiO1xuXG4gIGlmICghU0hBMV9SRUdFWC50ZXN0KHBhcmVudENvbW1pdElkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiaW52YWxpZCBQQVJFTlRfQ09NTUlUX0lEIGVudmlyb25tZW50IHZhcmlhYmxlLCBtdXN0IGJlIFNIQTEgY29tbWl0IElEXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIENhbid0IGluZGV4IHdpdGhvdXQgYSBwcmV2aW91cyBmaWxlIHdoaWNoIGNvbnRhaW5zIHRoZSBoYXNoIHRvIGluZGV4IHRvXG4gIGNvbnN0IHByZXZFbnRyb3B5ID0gYXdhaXQgcmVhZEpTT04oUFJFVl9FTlRST1BZX0ZJTEUpO1xuICBpZiAocHJldkVudHJvcHkpIHtcbiAgICBjb25zdCBwcmV2RW50cm9weUhhc2ggPSBwcmV2RW50cm9weT8uaGFzaDtcblxuICAgIGlmICghcHJldkVudHJvcHlIYXNoIHx8ICFTSEEyNTZfUkVHRVgudGVzdChwcmV2RW50cm9weUhhc2gpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJtaXNzaW5nIG9yIGludmFsaWQgZW50cm9weSBoYXNoIGluIGZpbGVcIik7XG4gICAgfVxuXG4gICAgRGVuby5ta2RpclN5bmMoSU5ERVhfRElSLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICBhd2FpdCB3cml0ZUpTT04oYCR7SU5ERVhfRElSfS8ke3ByZXZFbnRyb3B5SGFzaH0uanNvbmAsIHtcbiAgICAgIGlkOiBwYXJlbnRDb21taXRJZCxcbiAgICB9KTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBlbnRyb3B5LWluZGV4IDogaW5kZXggZmlsZSB3cml0dGVuIDogJyR7SU5ERVhfRElSfS8ke3ByZXZFbnRyb3B5SGFzaH0uanNvbicgOiAke3BhcmVudENvbW1pdElkfWAsXG4gICAgKTtcbiAgfVxufVxuXG4vLyAtLWVudHJvcHktdXBsb2FkLWt2XG5pZiAocGFyc2VkQXJnc1tcImVudHJvcHktdXBsb2FkLWt2XCJdKSB7XG4gIGNvbnN0IGVudHJvcHlGaWxlID0gYXdhaXQgcmVhZEpTT04oRU5UUk9QWV9GSUxFKVxuXG4gIGlmIChlbnRyb3B5RmlsZSkge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJlbnRyb3B5LXVwbG9hZC1rdiA6IFBVVFwiKTtcblxuICAgICAgICAgIGNvbnN0IHJldCA9IGF3YWl0IHB1dEtWTGF0ZXN0KGVudHJvcHlGaWxlKVxuXG4gICAgICAgICAgaWYgKHJldD8ub2spIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgZW50cm9weS11cGxvYWQta3YgOiBzdWNjZXNzIDogbGF0ZXN0IGVudHJvcHkuanNvbiBmaWxlIHdyaXR0ZW4gdG8gQ2xvdWRmbGFyZSBLViA6ICR7SlNPTi5zdHJpbmdpZnkocmV0LmRhdGEpfWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBJZiBhIGhlYXJ0YmVhdCBVUkwgd2FzIHByb3ZpZGVkLCBjYWxsIGl0IHdpdGggdGltZW91dFxuICAgICAgICAgICAgY29uc3QgaGVhcnRiZWF0VXJsID0gRGVuby5lbnYuZ2V0KCdCRVRURVJfVVBUSU1FX0hFQVJUQkVBVF9VUkwnKVxuICAgICAgICAgICAgaWYgKGhlYXJ0YmVhdFVybCkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhiID0gYXdhaXQgZ2V0KGhlYXJ0YmVhdFVybClcbiAgICAgICAgICAgICAgICBpZiAoaGI/Lm9rKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgYGVudHJvcHktdXBsb2FkLWt2IDogc3VjY2VzcyA6IGJldHRlciB1cHRpbWUgaGVhcnRiZWF0IGxvZ2dlZGAsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBiZXR0ZXIgdXB0aW1lIGhlYXJ0YmVhdCBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgYGVudHJvcHktdXBsb2FkLWt2IDogYmV0dGVyIHVwdGltZSBoZWFydGJlYXQgbm90IGxvZ2dlZCA6IG5vIEJFVFRFUl9VUFRJTUVfSEVBUlRCRUFUX1VSTCBwcm92aWRlZGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgZW50cm9weS11cGxvYWQta3YgOiBmYWlsZWQgOiBsYXRlc3QgZW50cm9weS5qc29uIGZpbGUgd2FzIE5PVCB3cml0dGVuIHRvIENsb3VkZmxhcmUgS1YgOiAke0pTT04uc3RyaW5naWZ5KHJldC5kYXRhKX1gLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgICAvLyBGYWlsZWQgdG8gc3VibWl0IGVudHJvcHktdXBsb2FkLWt2IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYGVudHJvcHktdXBsb2FkLWt2IHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYGVudHJvcHktdXBsb2FkLWt2IGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS53YXJuKGBlbnRyb3B5LXVwbG9hZC1rdiA6IGZhaWxlZCA6IHVuYWJsZSB0byByZWFkIGVudHJvcHkgZmlsZWApXG4gIH1cbn1cbiJdfQ==