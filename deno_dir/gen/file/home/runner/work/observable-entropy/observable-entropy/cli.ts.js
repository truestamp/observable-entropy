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
    const accountIdentifier = Deno.env.get('CF_ACCOUNT_ID');
    const namespaceIdentifier = Deno.env.get('CF_NAMESPACE_ID');
    const keyName = "latest";
    const expirationTtl = 60 * 6;
    const authEmail = Deno.env.get('CF_AUTH_EMAIL') || '';
    const authKey = Deno.env.get('CF_AUTH_KEY') || '';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountIdentifier}/storage/kv/namespaces/${namespaceIdentifier}/values/${keyName}?expiration_ttl=${expirationTtl}`;
    const entropyFile = await readJSON(ENTROPY_FILE);
    if (entropyFile) {
        let json;
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    "X-Auth-Email": authEmail,
                    "X-Auth-Key": authKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(entropyFile),
            });
            json = await response.json();
        }
        catch (error) {
            console.error(`entropy-upload-kv : ${error.message}`);
        }
        if (json.success) {
            console.log(`entropy-upload-kv : success : latest entropy.json file written to Cloudflare KV : ${JSON.stringify(json)}`);
        }
        else {
            console.log(`entropy-upload-kv : failed : latest entropy.json file was NOT written to Cloudflare KV : ${JSON.stringify(json)}`);
        }
    }
    else {
        console.log(`entropy-upload-kv : failed : unable to read entropy file`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUE7QUFDMUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVyRixPQUFPLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXJGLE9BQU8sS0FBSyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFL0QsT0FBTyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUV4RixNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUM7QUFDbkMsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO0FBQ3BDLE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQztBQUNoQyxNQUFNLGlCQUFpQixHQUFHLEdBQUcsV0FBVyx3QkFBd0IsQ0FBQztBQUNqRSxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQztBQUMxQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFDM0IsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDO0FBQy9CLE1BQU0sVUFBVSxHQUFHLGtDQUFrQyxDQUFDO0FBQ3RELE1BQU0sWUFBWSxHQUFHLGtDQUFrQyxDQUFDO0FBQ3hELE1BQU0sR0FBRyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7QUFDdkIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBcUJ6QixLQUFLLFVBQVUsUUFBUSxDQUFDLElBQVk7SUFDbEMsSUFBSTtRQUNGLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDekI7SUFBQyxPQUFPLE1BQU0sRUFBRTtRQUVmLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0FBQ0gsQ0FBQztBQUlELE1BQU0sQ0FBQyxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQVcsRUFBRSxPQUFPLEdBQUcsV0FBVztJQUUxRCxNQUFNLEdBQUcsR0FBd0IsRUFBRSxDQUFDO0lBQ3BDLElBQUk7UUFDRixNQUFNLENBQUMsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDaEQsTUFBTSxHQUFHLEdBQUcsTUFBTSxLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ25ELFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNqQixHQUFHLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNkLEdBQUcsQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDN0I7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLElBQUksR0FBRyxZQUFZLFlBQVksSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLFlBQVk7WUFDMUQsR0FBRyxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDOztZQUVoQyxHQUFHLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQztLQUN2QztJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELEtBQUssVUFBVSxTQUFTLENBQUMsSUFBWSxFQUFFLElBQTZCO0lBQ2xFLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUVELFNBQVMsYUFBYTtJQUNwQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMxRCxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sS0FBSyxFQUFFLEVBQUU7UUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FDYiwyREFBMkQsQ0FDNUQsQ0FBQztLQUNIO0lBQ0QsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVELEtBQUssVUFBVSxZQUFZO0lBQ3pCLE1BQU0sU0FBUyxHQUFHLE1BQU0sVUFBVSxDQUNoQyxLQUFLLElBQUksRUFBRTtRQUNULE9BQU8sQ0FBQyxHQUFHLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUU1QyxNQUFNLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFBO1FBQzlELElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1NBQzlEO1FBRUQsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsR0FBRyxJQUFJLENBQUE7UUFFbkMsTUFBTSxTQUFTLEdBQUcsWUFBWSxFQUFFLEdBQUcsQ0FBQztRQUNwQyxJQUFJLENBQUMsU0FBUyxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7WUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FDYiwwRkFBMEYsQ0FDM0YsQ0FBQztTQUNIO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQyxFQUNELEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQzNCLENBQUM7SUFFRixPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDO0FBSUQsTUFBTSxRQUFRLEdBQUcsR0FBYyxFQUFFO0lBQy9CLE1BQU0sS0FBSyxHQUFjLEVBQUUsQ0FBQztJQUc1QixLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLEVBQUU7UUFDcEQsSUFDRSxRQUFRLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUNsRDtZQUNBLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7U0FDckM7S0FDRjtJQUdELEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNqQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsV0FBVyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzlELE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzVCLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO1FBQzFCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQyxDQUFDLENBQUM7SUFHSCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDM0MsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25DLElBQUksS0FBSyxHQUFHLEtBQUssRUFBRTtZQUNqQixPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ1g7UUFDRCxJQUFJLEtBQUssR0FBRyxLQUFLLEVBQUU7WUFDakIsT0FBTyxDQUFDLENBQUM7U0FDVjtRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDLENBQUM7QUFHRixNQUFNLHFCQUFxQixHQUFHLENBQUMsS0FBZ0IsRUFBVSxFQUFFO0lBQ3pELE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNsQixLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTtRQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN4QjtJQUNELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QixDQUFDLENBQUM7QUFHRixNQUFNLFdBQVcsR0FBRyxDQUFDLElBQVksRUFBVSxFQUFFO0lBQzNDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQztJQUVuQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsZUFBZSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ3hDLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JCLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7S0FDM0I7SUFFRCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDLENBQUM7QUFFRixNQUFNLFVBQVUsR0FBRyxLQUFLLElBQXNCLEVBQUU7SUFDOUMsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsTUFBTSxzQkFBc0IsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM1RCxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUVyRCxNQUFNLE9BQU8sR0FBWTtRQUN2QixLQUFLLEVBQUUsS0FBSztRQUNaLFFBQVEsRUFBRSxTQUFTO1FBQ25CLGNBQWMsRUFBRSxlQUFlO1FBQy9CLElBQUksRUFBRSxRQUFRO1FBQ2QsU0FBUyxFQUFFLEdBQUcsQ0FBQyxXQUFXLEVBQUU7S0FDN0IsQ0FBQztJQUVGLElBQUksT0FBTyxDQUFDO0lBQ1osSUFBSSxVQUFVLENBQUMsa0JBQWtCLENBQUMsRUFBRTtRQUNsQyxPQUFPLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztRQUN2RCxPQUFPLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ2xEO0lBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUN0RCxPQUFPLENBQUMsUUFBUSxHQUFHLFdBQVcsRUFBRSxJQUFJLENBQUM7SUFFckMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QyxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDLENBQUM7QUFHRixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtJQUNsQyxPQUFPLEVBQUU7UUFDUCxPQUFPO1FBQ1AsU0FBUztRQUNULG1CQUFtQjtRQUNuQixpQkFBaUI7UUFDakIsa0JBQWtCO1FBQ2xCLGlCQUFpQjtRQUNqQixlQUFlO1FBQ2YsWUFBWTtRQUNaLGNBQWM7UUFDZCxzQkFBc0I7UUFDdEIsa0JBQWtCO1FBQ2xCLGdCQUFnQjtRQUNoQixlQUFlO1FBQ2YsbUJBQW1CO0tBQ3BCO0NBQ0YsQ0FBQyxDQUFDO0FBTUgsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUVyQixLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDNUMsSUFDRSxRQUFRLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUNsRCxRQUFRLENBQUMsSUFBSSxLQUFLLFlBQVk7WUFDOUIsUUFBUSxDQUFDLElBQUksS0FBSyxjQUFjLEVBQ2hDO1lBQ0EsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDaEM7S0FDRjtDQUNGO0FBVUQsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksVUFBVSxDQUFDLG1CQUFtQixDQUFDLEVBQUU7SUFDNUQsTUFBTSxVQUFVLENBQ2QsS0FBSyxJQUFJLEVBQUU7UUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDM0MsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzNCLE1BQU0sU0FBUyxDQUFDLEdBQUcsV0FBVyxpQkFBaUIsRUFBRTtZQUMvQyxTQUFTLEVBQUUsR0FBRyxDQUFDLFdBQVcsRUFBRTtTQUM3QixDQUFDLENBQUM7SUFDTCxDQUFDLEVBQ0QsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FDM0IsQ0FBQztDQUNIO0FBR0QsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7SUFDMUQsSUFBSTtRQUNGLE1BQU0sVUFBVSxDQUNkLEtBQUssSUFBSSxFQUFFO1lBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBRXpDLE1BQU0sSUFBSSxHQUFHLE1BQU0sR0FBRyxDQUFDLHFDQUFxQyxDQUFDLENBQUE7WUFDN0QsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO2FBQzlEO1lBRUQsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQTtZQUdyQixNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQztZQUM3RCxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDM0IsTUFBTSxTQUFTLENBQUMsR0FBRyxXQUFXLGVBQWUsRUFBRTtnQkFDN0MsTUFBTTtnQkFDTixJQUFJO2dCQUNKLElBQUk7Z0JBQ0osVUFBVTthQUNYLENBQUMsQ0FBQztRQUNMLENBQUMsRUFDRCxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUMzQixDQUFDO0tBQ0g7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNkLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBRXpCLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ2xFO2FBQU07WUFDTCxPQUFPLENBQUMsS0FBSyxDQUFDLDRCQUE0QixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztTQUM1RDtLQUNGO0NBQ0Y7QUFHRCxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxVQUFVLENBQUMsa0JBQWtCLENBQUMsRUFBRTtJQUMzRCxJQUFJO1FBQ0YsTUFBTSxVQUFVLENBQ2QsS0FBSyxJQUFJLEVBQUU7WUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7WUFFMUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxHQUFHLENBQUMseUNBQXlDLENBQUMsQ0FBQTtZQUNqRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7YUFDOUQ7WUFFRCxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFBO1lBRXJCLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUMzQixNQUFNLFNBQVMsQ0FBQyxHQUFHLFdBQVcsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEQsQ0FBQyxFQUNELEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQzNCLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFFekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDbkU7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkJBQTZCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQzdEO0tBQ0Y7Q0FDRjtBQUdELElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxjQUFjLENBQUMsRUFBRTtJQUN2RCxJQUFJO1FBQ0YsTUFBTSxVQUFVLENBQ2QsS0FBSyxJQUFJLEVBQUU7WUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFFN0MsTUFBTSxJQUFJLEdBQUcsTUFBTSxHQUFHLENBQUMsK0NBQStDLENBQUMsQ0FBQTtZQUN2RSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7YUFDOUQ7WUFFRCxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFBO1lBRXJCLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUMzQixNQUFNLFNBQVMsQ0FBQyxHQUFHLFdBQVcsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDM0QsQ0FBQyxFQUNELEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQzNCLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFFekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDdEU7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ2hFO0tBQ0Y7Q0FDRjtBQUdELElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO0lBQy9ELElBQUk7UUFDRixNQUFNLFVBQVUsQ0FDZCxLQUFLLElBQUksRUFBRTtZQUNULE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztZQUU5QyxNQUFNLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFBO1lBQy9ELElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtnQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUM5RDtZQUVELE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUE7WUFFckIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQ2Isd0RBQXdELElBQUksRUFBRSxDQUMvRCxDQUFDO2FBQ0g7WUFFRCxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDM0IsTUFBTSxTQUFTLENBQUMsR0FBRyxXQUFXLG9CQUFvQixFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNoRSxDQUFDLEVBQ0QsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FDM0IsQ0FBQztLQUNIO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDZCxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUV6QixPQUFPLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztTQUN2RTthQUFNO1lBQ0wsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDakU7S0FDRjtDQUNGO0FBR0QsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLEVBQUU7SUFDMUQsSUFBSTtRQUNGLE1BQU0sVUFBVSxDQUNkLEtBQUssSUFBSSxFQUFFO1lBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBSXpDLE1BQU0sU0FBUyxHQUFHLE1BQU0sR0FBRyxDQUFDLHVDQUF1QyxDQUFDLENBQUE7WUFDcEUsSUFBSSxTQUFTLENBQUMsR0FBRyxFQUFFO2dCQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUNuRTtZQUVELE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEdBQUcsU0FBUyxDQUFBO1lBR3BDLE1BQU0sVUFBVSxHQUFHLE1BQU0sR0FBRyxDQUFDLHVDQUF1QyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQTtZQUMzRixJQUFJLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO2FBQ3BFO1lBRUQsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsR0FBRyxVQUFVLENBQUE7WUFFekMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNCLE1BQU0sU0FBUyxDQUFDLEdBQUcsV0FBVyxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDL0QsQ0FBQyxFQUNELEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQzNCLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFFekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxrQ0FBa0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDbEU7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQzVEO0tBQ0Y7Q0FDRjtBQUdELElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxlQUFlLENBQUMsRUFBRTtJQUt4RCxJQUFJO1FBQ0YsTUFBTSxVQUFVLENBQ2QsS0FBSyxJQUFJLEVBQUU7WUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7WUFDOUMsTUFBTSxJQUFJLEdBQUc7Z0JBQ1gsOEJBQThCO2FBQy9CLENBQUM7WUFFRixNQUFNLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFBO1lBQzNELElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtnQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUM5RDtZQUVELE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFBO1lBRWhDLE1BQU0sT0FBTyxHQUFHLEVBQUUsU0FBUyxFQUFFLENBQUM7WUFFOUIsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUM5QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQ2xDLE9BQU8sQ0FDUixDQUFDO1lBRUYsTUFBTSxVQUFVLEdBQUcsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7WUFFdEMsTUFBTSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7WUFFckIsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNCLE1BQU0sU0FBUyxDQUFDLEdBQUcsV0FBVyxvQkFBb0IsRUFBRTtnQkFDbEQsU0FBUztnQkFDVCxVQUFVO2FBQ1gsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxFQUNELEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQzNCLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFFekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDaEU7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsMEJBQTBCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQzFEO0tBQ0Y7Q0FDRjtBQUdELElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtJQUdyRCxJQUFJO1FBQ0YsTUFBTSxVQUFVLENBQ2QsS0FBSyxJQUFJLEVBQUU7WUFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFFN0MsTUFBTSxJQUFJLEdBQUcsTUFBTSxHQUFHLENBQUMsdURBQXVELENBQUMsQ0FBQTtZQUMvRSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7YUFDOUQ7WUFFRCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQTtZQUVsQyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFFbkIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDM0IsTUFBTSxTQUFTLEdBQUcsTUFBTSxHQUFHLENBQUMsOENBQThDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUE7Z0JBQ2hHLElBQUksU0FBUyxDQUFDLEdBQUcsRUFBRTtvQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7aUJBQ25FO2dCQUVELE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsU0FBUyxDQUFBO2dCQUVqQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ3JCO1lBRUQsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNCLE1BQU0sU0FBUyxDQUFDLEdBQUcsV0FBVyxtQkFBbUIsRUFBRSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDbEUsQ0FBQyxFQUNELEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQzNCLENBQUM7S0FDSDtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2QsSUFBSSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFFekIsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDdEU7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ2hFO0tBQ0Y7Q0FDRjtBQU1ELElBQUksVUFBVSxDQUFDLGtCQUFrQixDQUFDLEVBQUU7SUFFbEMsSUFBSSxNQUFNLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRTtRQUNoQyxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ25ELE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLGlCQUFpQixHQUFHLENBQUMsQ0FBQztLQUMzRDtJQUdELE1BQU0sT0FBTyxHQUFHLE1BQU0sVUFBVSxFQUFFLENBQUM7SUFDbkMsTUFBTSxTQUFTLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztDQUNwQztBQUdELElBQUksVUFBVSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7SUFHaEMsTUFBTSxjQUFjLEdBQUcsTUFBTSxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDcEQsSUFBSSxDQUFDLGNBQWMsRUFBRTtRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixZQUFZLGFBQWEsQ0FBQyxDQUFDO0tBQzlEO0lBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxZQUFZLEVBQUUsQ0FBQztJQUV2QyxJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsTUFBTSxJQUFJLEtBQUssQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO0tBQ25FO0lBRUQsSUFDRSxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FDZCxjQUFjLENBQUMsU0FBUyxFQUN4QixjQUFjLENBQUMsSUFBSSxFQUNuQixTQUFTLENBQ1YsRUFDRDtRQUNBLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztLQUMzQztJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sVUFBVSxFQUFFLENBQUM7SUFHbkMsT0FBTyxjQUFjLENBQUMsU0FBUyxDQUFDO0lBQ2hDLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQztJQUN6QixpQkFBaUIsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDM0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0NBQ25DO0FBR0QsSUFBSSxVQUFVLENBQUMsZUFBZSxDQUFDLEVBQUU7SUFDL0IsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFOUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUU7UUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FDYix1RUFBdUUsQ0FDeEUsQ0FBQztLQUNIO0lBR0QsTUFBTSxXQUFXLEdBQUcsTUFBTSxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUN0RCxJQUFJLFdBQVcsRUFBRTtRQUNmLE1BQU0sZUFBZSxHQUFHLFdBQVcsRUFBRSxJQUFJLENBQUM7UUFFMUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQUU7WUFDM0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO1NBQzVEO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvQyxNQUFNLFNBQVMsQ0FBQyxHQUFHLFNBQVMsSUFBSSxlQUFlLE9BQU8sRUFBRTtZQUN0RCxFQUFFLEVBQUUsY0FBYztTQUNuQixDQUFDLENBQUM7UUFDSCxPQUFPLENBQUMsR0FBRyxDQUNULHlDQUF5QyxTQUFTLElBQUksZUFBZSxZQUFZLGNBQWMsRUFBRSxDQUNsRyxDQUFDO0tBQ0g7Q0FDRjtBQUdELElBQUksVUFBVSxDQUFDLG1CQUFtQixDQUFDLEVBQUU7SUFDbkMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQTtJQUN2RCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUE7SUFDM0QsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFBO0lBQ3hCLE1BQU0sYUFBYSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUE7SUFDNUIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFBO0lBQ3JELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUNqRCxNQUFNLEdBQUcsR0FBRyxpREFBaUQsaUJBQWlCLDBCQUEwQixtQkFBbUIsV0FBVyxPQUFPLG1CQUFtQixhQUFhLEVBQUUsQ0FBQTtJQUMvSyxNQUFNLFdBQVcsR0FBRyxNQUFNLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQTtJQUVoRCxJQUFJLFdBQVcsRUFBRTtRQUNmLElBQUksSUFBSSxDQUFBO1FBQ1IsSUFBSTtZQUNGLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRTtnQkFDaEMsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsT0FBTyxFQUFFO29CQUNQLGNBQWMsRUFBRSxTQUFTO29CQUN6QixZQUFZLEVBQUUsT0FBTztvQkFDckIsY0FBYyxFQUFFLGtCQUFrQjtpQkFDbkM7Z0JBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDO2FBQ2xDLENBQUMsQ0FBQztZQUNILElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUM5QjtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsT0FBTyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDdkQ7UUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFFaEIsT0FBTyxDQUFDLEdBQUcsQ0FDVCxxRkFBcUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUM1RyxDQUFDO1NBQ0g7YUFBTTtZQUNMLE9BQU8sQ0FBQyxHQUFHLENBQ1QsNEZBQTRGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDbkgsQ0FBQztTQUNIO0tBQ0Y7U0FBTTtRQUNMLE9BQU8sQ0FBQyxHQUFHLENBQUMsMERBQTBELENBQUMsQ0FBQTtLQUN4RTtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC45OC4wL2hhc2gvbW9kLnRzXCI7XG5pbXBvcnQgeyBTdGF0dXMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTI5LjAvaHR0cC9odHRwX3N0YXR1cy50c1wiXG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xMjkuMC9mbGFncy9tb2QudHNcIjtcbmltcG9ydCB7IGVuc3VyZURpclN5bmMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTI5LjAvZnMvbW9kLnRzXCI7XG5pbXBvcnQgeyBhc3NlcnRPYmplY3RNYXRjaCB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xMjkuMC90ZXN0aW5nL2Fzc2VydHMudHNcIjtcblxuaW1wb3J0IHsgcmV0cnlBc3luYywgaXNUb29NYW55VHJpZXMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQveC9yZXRyeUB2Mi4wLjAvbW9kLnRzXCI7XG5cbmltcG9ydCAqIGFzIGVkIGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L2VkMjU1MTlAMS42LjAvbW9kLnRzXCI7XG5cbmltcG9ydCBDbGllbnQsIHsgSFRUUCB9IGZyb20gXCJodHRwczovL2Nkbi5qc2RlbGl2ci5uZXQvbnBtL2RyYW5kLWNsaWVudEAwLjIuMC9kcmFuZC5qc1wiO1xuXG5jb25zdCBERU5PX0xPQ0tfRklMRSA9IFwibG9jay5qc29uXCI7XG5jb25zdCBFTlRST1BZX0ZJTEUgPSBcImVudHJvcHkuanNvblwiO1xuY29uc3QgRU5UUk9QWV9ESVIgPSBcIi4vZW50cm9weVwiO1xuY29uc3QgUFJFVl9FTlRST1BZX0ZJTEUgPSBgJHtFTlRST1BZX0RJUn0vZW50cm9weV9wcmV2aW91cy5qc29uYDtcbmNvbnN0IElOREVYX0RJUiA9IFwiaW5kZXgvYnkvZW50cm9weV9oYXNoXCI7XG5jb25zdCBIQVNIX1RZUEUgPSBcInNoYTI1NlwiO1xuY29uc3QgSEFTSF9JVEVSQVRJT05TID0gNTAwMDAwO1xuY29uc3QgU0hBMV9SRUdFWCA9IC9eKD86KDB4KSooW0EtRmEtZjAtOV17Mn0pezIwfSkkL2k7XG5jb25zdCBTSEEyNTZfUkVHRVggPSAvXig/OigweCkqKFtBLUZhLWYwLTldezJ9KXszMn0pJC9pO1xuY29uc3QgTk9XID0gbmV3IERhdGUoKTtcbmNvbnN0IEdFVF9USU1FT1VUID0gNTAwMDtcblxuaW50ZXJmYWNlIEpTT05GaWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICBoYXNoPzogc3RyaW5nO1xuICBoYXNoVHlwZT86IHN0cmluZztcbn1cblxudHlwZSBKU09ORmlsZXMgPSBKU09ORmlsZVtdO1xuXG50eXBlIEVudHJvcHkgPSB7XG4gIGZpbGVzOiBKU09ORmlsZXM7XG4gIGhhc2hUeXBlOiBzdHJpbmc7XG4gIGhhc2hJdGVyYXRpb25zOiBudW1iZXI7XG4gIGhhc2g6IHN0cmluZztcbiAgcHJldkhhc2g/OiBzdHJpbmc7XG4gIHNpZ25hdHVyZT86IHN0cmluZztcbiAgY3JlYXRlZEF0Pzogc3RyaW5nO1xufTtcblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmFzeW5jIGZ1bmN0aW9uIHJlYWRKU09OKHBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55IHwgdW5kZWZpbmVkPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IERlbm8ucmVhZFRleHRGaWxlKHBhdGgpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpO1xuICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICAvLyBjb25zb2xlLmVycm9yKF9lcnJvcik7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vLyBHZXQgSlNPTiBmcm9tIGEgVVJMIHdpdGggYSB0aW1lb3V0XG4vLyBodHRwczovL21lZGl1bS5jb20vZGVuby10aGUtY29tcGxldGUtcmVmZXJlbmNlL2ZldGNoLXRpbWVvdXQtaW4tZGVuby05MTczMWJjYTgwYTFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXQodXJsOiBzdHJpbmcsIHRpbWVvdXQgPSBHRVRfVElNRU9VVCkge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjb25zdCByZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiBjLmFib3J0KCksIHRpbWVvdXQpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwgeyBzaWduYWw6IGMuc2lnbmFsIH0pO1xuICAgIGNsZWFyVGltZW91dChpZCk7XG4gICAgcmV0Lm9rID0gdHJ1ZTtcbiAgICByZXQuZGF0YSA9IGF3YWl0IHJlcy5qc29uKCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChlcnIgaW5zdGFuY2VvZiBET01FeGNlcHRpb24gJiYgZXJyLm5hbWUgPT09ICdBYm9ydEVycm9yJylcbiAgICAgIHJldC5lcnIgPSBTdGF0dXMuUmVxdWVzdFRpbWVvdXQ7XG4gICAgZWxzZVxuICAgICAgcmV0LmVyciA9IFN0YXR1cy5TZXJ2aWNlVW5hdmFpbGFibGU7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gd3JpdGVKU09OKHBhdGg6IHN0cmluZywgZGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pIHtcbiAgYXdhaXQgRGVuby53cml0ZVRleHRGaWxlKHBhdGgsIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcbn1cblxuZnVuY3Rpb24gZ2V0UHJpdmF0ZUtleSgpOiBzdHJpbmcge1xuICBjb25zdCBwcml2S2V5ID0gRGVuby5lbnYuZ2V0KFwiRUQyNTUxOV9QUklWQVRFX0tFWVwiKSB8fCBcIlwiO1xuICBpZiAoIXByaXZLZXkgfHwgcHJpdktleSA9PT0gXCJcIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwibWlzc2luZyByZXF1aXJlZCBlbnZpcm9ubWVudCB2YXJpYWJsZSBFRDI1NTE5X1BSSVZBVEVfS0VZXCIsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gcHJpdktleTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0UHVibGljS2V5KCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IHB1YmxpY0tleSA9IGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coXCJ2ZXJpZnkgOiByZXRyaWV2ZSBwdWJsaWMga2V5XCIpO1xuXG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9lbnRyb3B5LnRydWVzdGFtcC5jb20vcHVia2V5XCIpXG4gICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGRhdGE6IHB1YmxpY0tleU9iaiB9ID0gcmVzcFxuXG4gICAgICBjb25zdCBwdWJsaWNLZXkgPSBwdWJsaWNLZXlPYmo/LmtleTtcbiAgICAgIGlmICghcHVibGljS2V5IHx8IHB1YmxpY0tleSA9PT0gXCJcIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgXCJmYWlsZWQgdG8gcmV0cmlldmUgcmVxdWlyZWQgZWQyNTUxOSBwdWJsaWMga2V5IGZyb20gaHR0cHM6Ly9lbnRyb3B5LnRydWVzdGFtcC5jb20vcHVia2V5XCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcHVibGljS2V5O1xuICAgIH0sXG4gICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICk7XG5cbiAgcmV0dXJuIHB1YmxpY0tleTtcbn1cblxuLy8gRmluZCBhbGwgKi5qc29uIGZpbGVzIGluIHRoaXMgZGlyIGZvciBoYXNoaW5nLlxuLy8gSW5jbHVkZXMgdGhlIHByZXZpb3VzIGVudHJvcHkgZmlsZSBidXQgbm90IHRoZSBjdXJyZW50IG9uZS5cbmNvbnN0IGdldEZpbGVzID0gKCk6IEpTT05GaWxlcyA9PiB7XG4gIGNvbnN0IGZpbGVzOiBKU09ORmlsZXMgPSBbXTtcblxuICAvLyBjb2xsZWN0IHRoZSAnLmpzb24nIGZpbGVzIGZyb20gZGlyXG4gIGZvciAoY29uc3QgZGlyRW50cnkgb2YgRGVuby5yZWFkRGlyU3luYyhFTlRST1BZX0RJUikpIHtcbiAgICBpZiAoXG4gICAgICBkaXJFbnRyeS5pc0ZpbGUgJiYgZGlyRW50cnkubmFtZS5lbmRzV2l0aChcIi5qc29uXCIpXG4gICAgKSB7XG4gICAgICBmaWxlcy5wdXNoKHsgbmFtZTogZGlyRW50cnkubmFtZSB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBjYWxjdWxhdGUgdGhlIGhhc2ggb2YgZWFjaCBmaWxlXG4gIGZpbGVzLm1hcCgoZmlsZSkgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBEZW5vLnJlYWRGaWxlU3luYyhgJHtFTlRST1BZX0RJUn0vJHtmaWxlLm5hbWV9YCk7XG4gICAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goSEFTSF9UWVBFKTtcbiAgICBoYXNoLnVwZGF0ZShkYXRhKTtcbiAgICBmaWxlLmhhc2ggPSBoYXNoLnRvU3RyaW5nKCk7XG4gICAgZmlsZS5oYXNoVHlwZSA9IEhBU0hfVFlQRTtcbiAgICByZXR1cm4gZmlsZTtcbiAgfSk7XG5cbiAgLy8gc29ydCBBcnJheSBvZiBPYmplY3RzIGJ5IGZpbGUgbmFtZSBzbyB0aGUgc29ydCBvcmRlciBhbmQgcmVzdWx0YW50IGhhc2ggaXMgZGV0ZXJtaW5pc3RpY1xuICBjb25zdCBzb3J0ZWRGaWxlcyA9IGZpbGVzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICBjb25zdCBuYW1lQSA9IGEubmFtZS50b1VwcGVyQ2FzZSgpOyAvLyBpZ25vcmUgdXBwZXIgYW5kIGxvd2VyY2FzZVxuICAgIGNvbnN0IG5hbWVCID0gYi5uYW1lLnRvVXBwZXJDYXNlKCk7IC8vIGlnbm9yZSB1cHBlciBhbmQgbG93ZXJjYXNlXG4gICAgaWYgKG5hbWVBIDwgbmFtZUIpIHtcbiAgICAgIHJldHVybiAtMTsgLy9uYW1lQSBjb21lcyBmaXJzdFxuICAgIH1cbiAgICBpZiAobmFtZUEgPiBuYW1lQikge1xuICAgICAgcmV0dXJuIDE7IC8vIG5hbWVCIGNvbWVzIGZpcnN0XG4gICAgfVxuICAgIHJldHVybiAwOyAvLyBuYW1lcyBtdXN0IGJlIGVxdWFsXG4gIH0pO1xuXG4gIHJldHVybiBzb3J0ZWRGaWxlcztcbn07XG5cbi8vIGNvbmNhdGVuYXRlIGFsbCBvZiB0aGUgaW5kaXZpZHVhbCBmaWxlcyBoYXNoZXMgaW50byBvbmUgbG9uZyBoYXNoIHN0cmluZ1xuY29uc3QgY29uY2F0ZW5hdGVGaWxlSGFzaGVzID0gKGZpbGVzOiBKU09ORmlsZXMpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBoYXNoZXMgPSBbXTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgaGFzaGVzLnB1c2goZmlsZS5oYXNoKTtcbiAgfVxuICByZXR1cm4gaGFzaGVzLmpvaW4oXCJcIik7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIG5ldyBoYXNoIHNsb3dseSAobmHDr3ZlIHVuaWNvcm4gc3R5bGUgJ3Nsb3RoJyBmdW5jdGlvbilcbmNvbnN0IGdlblNsb3dIYXNoID0gKGhhc2g6IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIGxldCBuZXdIYXNoID0gaGFzaDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IEhBU0hfSVRFUkFUSU9OUzsgaSsrKSB7XG4gICAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goSEFTSF9UWVBFKTtcbiAgICBoYXNoLnVwZGF0ZShuZXdIYXNoKTtcbiAgICBuZXdIYXNoID0gaGFzaC50b1N0cmluZygpO1xuICB9XG5cbiAgcmV0dXJuIG5ld0hhc2g7XG59O1xuXG5jb25zdCBnZW5FbnRyb3B5ID0gYXN5bmMgKCk6IFByb21pc2U8RW50cm9weT4gPT4ge1xuICBjb25zdCBmaWxlcyA9IGdldEZpbGVzKCk7XG4gIGNvbnN0IGNvbmNhdGVuYXRlZEZpbGVIYXNoZXMgPSBjb25jYXRlbmF0ZUZpbGVIYXNoZXMoZmlsZXMpO1xuICBjb25zdCBzbG93SGFzaCA9IGdlblNsb3dIYXNoKGNvbmNhdGVuYXRlZEZpbGVIYXNoZXMpO1xuXG4gIGNvbnN0IGVudHJvcHk6IEVudHJvcHkgPSB7XG4gICAgZmlsZXM6IGZpbGVzLFxuICAgIGhhc2hUeXBlOiBIQVNIX1RZUEUsXG4gICAgaGFzaEl0ZXJhdGlvbnM6IEhBU0hfSVRFUkFUSU9OUyxcbiAgICBoYXNoOiBzbG93SGFzaCxcbiAgICBjcmVhdGVkQXQ6IE5PVy50b0lTT1N0cmluZygpLFxuICB9O1xuXG4gIGxldCBoYXNoU2lnO1xuICBpZiAocGFyc2VkQXJnc1tcImVudHJvcHktZ2VuZXJhdGVcIl0pIHtcbiAgICBoYXNoU2lnID0gYXdhaXQgZWQuc2lnbihlbnRyb3B5Lmhhc2gsIGdldFByaXZhdGVLZXkoKSk7XG4gICAgZW50cm9weS5zaWduYXR1cmUgPSBlZC51dGlscy5ieXRlc1RvSGV4KGhhc2hTaWcpO1xuICB9XG5cbiAgY29uc3QgcHJldkVudHJvcHkgPSBhd2FpdCByZWFkSlNPTihQUkVWX0VOVFJPUFlfRklMRSk7XG4gIGVudHJvcHkucHJldkhhc2ggPSBwcmV2RW50cm9weT8uaGFzaDtcblxuICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShlbnRyb3B5LCBudWxsLCAyKSk7XG4gIHJldHVybiBlbnRyb3B5O1xufTtcblxuLy8gQ0xJIEFyZ3VtZW50IEhhbmRsZXJcbmNvbnN0IHBhcnNlZEFyZ3MgPSBwYXJzZShEZW5vLmFyZ3MsIHtcbiAgYm9vbGVhbjogW1xuICAgIFwiY2xlYW5cIixcbiAgICBcImNvbGxlY3RcIixcbiAgICBcImNvbGxlY3QtdGltZXN0YW1wXCIsXG4gICAgXCJjb2xsZWN0LWJpdGNvaW5cIixcbiAgICBcImNvbGxlY3QtZXRoZXJldW1cIixcbiAgICBcImNvbGxlY3Qtc3RlbGxhclwiLFxuICAgIFwiY29sbGVjdC1kcmFuZFwiLFxuICAgIFwiY29sbGVjdC1oblwiLFxuICAgIFwiY29sbGVjdC1uaXN0XCIsXG4gICAgXCJjb2xsZWN0LXVzZXItZW50cm9weVwiLFxuICAgIFwiZW50cm9weS1nZW5lcmF0ZVwiLFxuICAgIFwiZW50cm9weS12ZXJpZnlcIixcbiAgICBcImVudHJvcHktaW5kZXhcIixcbiAgICBcImVudHJvcHktdXBsb2FkLWt2XCJcbiAgXSxcbn0pO1xuXG4vLyBDTEVBTlVQXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gLS1jbGVhblxuaWYgKHBhcnNlZEFyZ3NbXCJjbGVhblwiXSkge1xuICBjb25zb2xlLmxvZyhcImNsZWFuXCIpO1xuICAvLyBDbGVhbnVwIGFueSBjb2xsZWN0ZWQgKi5qc29uIGZpbGVzIChmb3IgZGV2ZWxvcG1lbnQpXG4gIGZvciAoY29uc3QgZGlyRW50cnkgb2YgRGVuby5yZWFkRGlyU3luYyhcIi5cIikpIHtcbiAgICBpZiAoXG4gICAgICBkaXJFbnRyeS5pc0ZpbGUgJiYgZGlyRW50cnkubmFtZS5lbmRzV2l0aChcIi5qc29uXCIpICYmXG4gICAgICBkaXJFbnRyeS5uYW1lICE9PSBFTlRST1BZX0ZJTEUgJiZcbiAgICAgIGRpckVudHJ5Lm5hbWUgIT09IERFTk9fTE9DS19GSUxFXG4gICAgKSB7XG4gICAgICBEZW5vLnJlbW92ZVN5bmMoZGlyRW50cnkubmFtZSk7XG4gICAgfVxuICB9XG59XG5cbi8vIEVOVFJPUFkgQ09MTEVDVElPTlxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIEVhY2ggY29sbGVjdGlvbiBzb3VyY2Ugd2lsbCBiZSByZXRyaWVkIG9uIGZhaWx1cmUsIGJ1dCBpZiBpdFxuLy8gZmluYWxseSBzdGlsbCByYWlzZXMgYW4gZXJyb3IgaXQgd2lsbCBqdXN0IGJlIGxvZ2dlZCBhbmQgdGhpc1xuLy8gc291cmNlIHdpbGwgYmUgc2tpcHBlZC5cblxuLy8gVElNRVNUQU1QXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtdGltZXN0YW1wXCJdKSB7XG4gIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiB0aW1lc3RhbXBcIik7XG4gICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vdGltZXN0YW1wLmpzb25gLCB7XG4gICAgICAgIHRpbWVzdGFtcDogTk9XLnRvSVNPU3RyaW5nKCksXG4gICAgICB9KTtcbiAgICB9LFxuICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICApO1xufVxuXG4vLyBCSVRDT0lOXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtYml0Y29pblwiXSkge1xuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogYml0Y29pblwiKTtcblxuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9ibG9ja2NoYWluLmluZm8vbGF0ZXN0YmxvY2tcIilcbiAgICAgICAgaWYgKHJlc3AuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3AuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXNwXG5cbiAgICAgICAgLy8gZXh0cmFjdCBqdXN0IHRoZSBkYXRhIHdlIHdhbnRcbiAgICAgICAgY29uc3QgeyBoZWlnaHQsIGhhc2gsIHRpbWUsIGJsb2NrX2luZGV4OiBibG9ja0luZGV4IH0gPSBkYXRhO1xuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS9iaXRjb2luLmpzb25gLCB7XG4gICAgICAgICAgaGVpZ2h0LFxuICAgICAgICAgIGhhc2gsXG4gICAgICAgICAgdGltZSxcbiAgICAgICAgICBibG9ja0luZGV4LFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBiaXRjb2luIHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBiaXRjb2luIGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRVRIRVJFVU1cbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC1ldGhlcmV1bVwiXSkge1xuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogZXRoZXJldW1cIik7XG5cbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vYXBpLmJsb2NrY3lwaGVyLmNvbS92MS9ldGgvbWFpblwiKVxuICAgICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3BcblxuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS9ldGhlcmV1bS5qc29uYCwgZGF0YSk7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgZXRoZXJldW0gdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGV0aGVyZXVtIGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gTklTVCBCRUFDT05cbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC1uaXN0XCJdKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcmV0cnlBc3luYyhcbiAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjb2xsZWN0IGF0dGVtcHQgOiBuaXN0LWJlYWNvblwiKTtcblxuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9iZWFjb24ubmlzdC5nb3YvYmVhY29uLzIuMC9wdWxzZS9sYXN0XCIpXG4gICAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YSB9ID0gcmVzcFxuXG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L25pc3QtYmVhY29uLmpzb25gLCBkYXRhKTtcbiAgICAgIH0sXG4gICAgICB7IGRlbGF5OiAxMDAwLCBtYXhUcnk6IDMgfSxcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChpc1Rvb01hbnlUcmllcyhlcnJvcikpIHtcbiAgICAgIC8vIERpZCBub3QgY29sbGVjdCBhZnRlciAnbWF4VHJ5JyBjYWxsc1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBuaXN0LWJlYWNvbiB0b29NYW55VHJpZXMgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgbmlzdC1iZWFjb24gZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBVU0VSIEVOVFJPUFlcbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC11c2VyLWVudHJvcHlcIl0pIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IHVzZXItZW50cm9weVwiKTtcblxuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9lbnRyb3B5LnRydWVzdGFtcC5jb20vZW50cmllc1wiKVxuICAgICAgICBpZiAocmVzcC5lcnIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGZhaWxlZCB0byBmZXRjaCA6IHN0YXR1cyBjb2RlICR7cmVzcC5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3BcblxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgY29sbGVjdCBhdHRlbXB0IDogdXNlci1lbnRyb3B5IDogZXhwZWN0ZWQgQXJyYXksIGdvdCAke2RhdGF9YCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vdXNlci1lbnRyb3B5Lmpzb25gLCB7IGRhdGEgfSk7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgdXNlci1lbnRyb3B5IHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCB1c2VyLWVudHJvcHkgZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBTVEVMTEFSXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3Qtc3RlbGxhclwiXSkge1xuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogc3RlbGxhclwiKTtcbiAgICAgICAgLy8gUmV0cmlldmUgdGhlIGxhc3QgbGVkZ2VyIElELlxuICAgICAgICAvLyBjdXJsIC1YIEdFVCBcImh0dHBzOi8vaG9yaXpvbi5zdGVsbGFyLm9yZy9mZWVfc3RhdHNcIiA+IHN0ZWxsYXItZmVlLXN0YXRzLmpzb25cblxuICAgICAgICBjb25zdCByZXNwU3RhdHMgPSBhd2FpdCBnZXQoXCJodHRwczovL2hvcml6b24uc3RlbGxhci5vcmcvZmVlX3N0YXRzXCIpXG4gICAgICAgIGlmIChyZXNwU3RhdHMuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3BTdGF0cy5lcnJ9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IGRhdGE6IGZlZVN0YXRzIH0gPSByZXNwU3RhdHNcblxuICAgICAgICAvLyBSZWFkIHRoZSBsZWRnZXIgZm9yIGxhc3QgbGVkZ2VyIElEXG4gICAgICAgIGNvbnN0IHJlc3BMZWRnZXIgPSBhd2FpdCBnZXQoYGh0dHBzOi8vaG9yaXpvbi5zdGVsbGFyLm9yZy9sZWRnZXJzLyR7ZmVlU3RhdHMubGFzdF9sZWRnZXJ9YClcbiAgICAgICAgaWYgKHJlc3BMZWRnZXIuZXJyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBmYWlsZWQgdG8gZmV0Y2ggOiBzdGF0dXMgY29kZSAke3Jlc3BMZWRnZXIuZXJyfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBkYXRhOiBsYXRlc3RMZWRnZXIgfSA9IHJlc3BMZWRnZXJcblxuICAgICAgICBlbnN1cmVEaXJTeW5jKEVOVFJPUFlfRElSKTtcbiAgICAgICAgYXdhaXQgd3JpdGVKU09OKGAke0VOVFJPUFlfRElSfS9zdGVsbGFyLmpzb25gLCBsYXRlc3RMZWRnZXIpO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IHN0ZWxsYXIgdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IHN0ZWxsYXIgZmFpbGVkIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vLyBEUkFORCBCRUFDT05cbmlmIChwYXJzZWRBcmdzW1wiY29sbGVjdFwiXSB8fCBwYXJzZWRBcmdzW1wiY29sbGVjdC1kcmFuZFwiXSkge1xuICAvLyBEcmFuZCBCZWFjb25cbiAgLy8gaHR0cHM6Ly9kcmFuZC5sb3ZlL2RldmVsb3Blci9odHRwLWFwaS8jcHVibGljLWVuZHBvaW50c1xuICAvLyBodHRwczovL2dpdGh1Yi5jb20vZHJhbmQvZHJhbmQtY2xpZW50XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCByZXRyeUFzeW5jKFxuICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhcImNvbGxlY3QgYXR0ZW1wdCA6IGRyYW5kLWJlYWNvblwiKTtcbiAgICAgICAgY29uc3QgdXJscyA9IFtcbiAgICAgICAgICBcImh0dHBzOi8vZHJhbmQuY2xvdWRmbGFyZS5jb21cIixcbiAgICAgICAgXTtcblxuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZ2V0KFwiaHR0cHM6Ly9kcmFuZC5jbG91ZGZsYXJlLmNvbS9pbmZvXCIpXG4gICAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YTogY2hhaW5JbmZvIH0gPSByZXNwXG5cbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgY2hhaW5JbmZvIH07XG5cbiAgICAgICAgY29uc3QgY2xpZW50ID0gYXdhaXQgQ2xpZW50LndyYXAoXG4gICAgICAgICAgSFRUUC5mb3JVUkxzKHVybHMsIGNoYWluSW5mby5oYXNoKSxcbiAgICAgICAgICBvcHRpb25zLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IHJhbmRvbW5lc3MgPSBhd2FpdCBjbGllbnQuZ2V0KCk7XG5cbiAgICAgICAgYXdhaXQgY2xpZW50LmNsb3NlKCk7XG5cbiAgICAgICAgZW5zdXJlRGlyU3luYyhFTlRST1BZX0RJUik7XG4gICAgICAgIGF3YWl0IHdyaXRlSlNPTihgJHtFTlRST1BZX0RJUn0vZHJhbmQtYmVhY29uLmpzb25gLCB7XG4gICAgICAgICAgY2hhaW5JbmZvLFxuICAgICAgICAgIHJhbmRvbW5lc3MsXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIHsgZGVsYXk6IDEwMDAsIG1heFRyeTogMyB9LFxuICAgICk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzVG9vTWFueVRyaWVzKGVycm9yKSkge1xuICAgICAgLy8gRGlkIG5vdCBjb2xsZWN0IGFmdGVyICdtYXhUcnknIGNhbGxzXG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGRyYW5kIHRvb01hbnlUcmllcyA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihgY29sbGVjdCBkcmFuZCBmYWlsZWQgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8vIEhBQ0tFUiBORVdTXG5pZiAocGFyc2VkQXJnc1tcImNvbGxlY3RcIl0gfHwgcGFyc2VkQXJnc1tcImNvbGxlY3QtaG5cIl0pIHtcbiAgLy8gSGFja2VyIE5ld3MgQVBJOiBodHRwczovL2dpdGh1Yi5jb20vSGFja2VyTmV3cy9BUElcblxuICB0cnkge1xuICAgIGF3YWl0IHJldHJ5QXN5bmMoXG4gICAgICBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29sbGVjdCBhdHRlbXB0IDogaGFja2VyLW5ld3NcIik7XG5cbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGdldChcImh0dHBzOi8vaGFja2VyLW5ld3MuZmlyZWJhc2Vpby5jb20vdjAvbmV3c3Rvcmllcy5qc29uXCIpXG4gICAgICAgIGlmIChyZXNwLmVycikge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwLmVycn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHsgZGF0YTogbmV3c1N0b3JpZXMgfSA9IHJlc3BcblxuICAgICAgICBjb25zdCBzdG9yaWVzID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgcmVzcFN0b3J5ID0gYXdhaXQgZ2V0KGBodHRwczovL2hhY2tlci1uZXdzLmZpcmViYXNlaW8uY29tL3YwL2l0ZW0vJHtuZXdzU3Rvcmllc1tpXX0uanNvbmApXG4gICAgICAgICAgaWYgKHJlc3BTdG9yeS5lcnIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZmFpbGVkIHRvIGZldGNoIDogc3RhdHVzIGNvZGUgJHtyZXNwU3RvcnkuZXJyfWApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHsgZGF0YTogc3RvcnkgfSA9IHJlc3BTdG9yeVxuXG4gICAgICAgICAgc3Rvcmllcy5wdXNoKHN0b3J5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVuc3VyZURpclN5bmMoRU5UUk9QWV9ESVIpO1xuICAgICAgICBhd2FpdCB3cml0ZUpTT04oYCR7RU5UUk9QWV9ESVJ9L2hhY2tlci1uZXdzLmpzb25gLCB7IHN0b3JpZXMgfSk7XG4gICAgICB9LFxuICAgICAgeyBkZWxheTogMTAwMCwgbWF4VHJ5OiAzIH0sXG4gICAgKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoaXNUb29NYW55VHJpZXMoZXJyb3IpKSB7XG4gICAgICAvLyBEaWQgbm90IGNvbGxlY3QgYWZ0ZXIgJ21heFRyeScgY2FsbHNcbiAgICAgIGNvbnNvbGUuZXJyb3IoYGNvbGxlY3QgaGFja2VyIG5ld3MgdG9vTWFueVRyaWVzIDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBjb2xsZWN0IGhhY2tlciBuZXdzIGZhaWxlZCA6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRU5UUk9QWSBHRU5FUkFUSU9OXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gLS1lbnRyb3B5LWdlbmVyYXRlXG5pZiAocGFyc2VkQXJnc1tcImVudHJvcHktZ2VuZXJhdGVcIl0pIHtcbiAgLy8gQ29weSBleGlzdGluZyBlbnRyb3B5IGZpbGUgdG8gcHJldiB2ZXJzaW9uXG4gIGlmIChhd2FpdCByZWFkSlNPTihFTlRST1BZX0ZJTEUpKSB7XG4gICAgRGVuby5jb3B5RmlsZVN5bmMoRU5UUk9QWV9GSUxFLCBQUkVWX0VOVFJPUFlfRklMRSk7XG4gICAgY29uc29sZS5sb2coYGVudHJvcHkgOiBjb3BpZWQgdG8gJyR7UFJFVl9FTlRST1BZX0ZJTEV9J2ApO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgYW5kIG92ZXJ3cml0ZSBlbnRyb3B5IGZpbGVcbiAgY29uc3QgZW50cm9weSA9IGF3YWl0IGdlbkVudHJvcHkoKTtcbiAgYXdhaXQgd3JpdGVKU09OKEVOVFJPUFlfRklMRSwgZW50cm9weSk7XG4gIGNvbnNvbGUubG9nKFwiZW50cm9weSA6IGdlbmVyYXRlZFwiKTtcbn1cblxuLy8gLS1lbnRyb3B5LXZlcmlmeVxuaWYgKHBhcnNlZEFyZ3NbXCJlbnRyb3B5LXZlcmlmeVwiXSkge1xuICAvLyBDb21wYXJlIG5ld2x5IGNhbGN1bGF0ZWQgcmVzdWx0cyB0byB3aGF0J3MgYWxyZWFkeSBiZWVuIHdyaXR0ZW4gKGV4Y2x1ZGluZyB0aGUgY3JlYXRlZEF0IHByb3BlcnR5KVxuXG4gIGNvbnN0IGN1cnJlbnRFbnRyb3B5ID0gYXdhaXQgcmVhZEpTT04oRU5UUk9QWV9GSUxFKTtcbiAgaWYgKCFjdXJyZW50RW50cm9weSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgcmVxdWlyZWQgZmlsZSAnJHtFTlRST1BZX0ZJTEV9JyBub3QgZm91bmRgKTtcbiAgfVxuXG4gIGNvbnN0IHB1YmxpY0tleSA9IGF3YWl0IGdldFB1YmxpY0tleSgpO1xuXG4gIGlmICghcHVibGljS2V5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidW5hYmxlIHRvIHJldHJpZXZlIHB1YmxpYyBrZXkgZm9yIHZlcmlmaWNhdGlvblwiKTtcbiAgfVxuXG4gIGlmIChcbiAgICAhYXdhaXQgZWQudmVyaWZ5KFxuICAgICAgY3VycmVudEVudHJvcHkuc2lnbmF0dXJlLFxuICAgICAgY3VycmVudEVudHJvcHkuaGFzaCxcbiAgICAgIHB1YmxpY0tleSxcbiAgICApXG4gICkge1xuICAgIHRocm93IG5ldyBFcnJvcihcImludmFsaWQgaGFzaCBzaWduYXR1cmVcIik7XG4gIH1cblxuICBjb25zdCBlbnRyb3B5ID0gYXdhaXQgZ2VuRW50cm9weSgpO1xuICAvLyBJZ25vcmUgdGhlIGNyZWF0ZWRfYXQgaW4gdGhlIGNvbW1pdHRlZCB2cyBjdXJyZW50IEpTT04gY29tcGFyaXNvblxuICAvLyB0aGlzIHdpbGwgYWx3YXlzIGJlIGRpZmZlcmVudCBiZXR3ZWVuIGNyZWF0aW9uIGFuZCB2ZXJpZmljYXRpb24uXG4gIGRlbGV0ZSBjdXJyZW50RW50cm9weS5jcmVhdGVkQXQ7XG4gIGRlbGV0ZSBlbnRyb3B5LmNyZWF0ZWRBdDtcbiAgYXNzZXJ0T2JqZWN0TWF0Y2goY3VycmVudEVudHJvcHksIGVudHJvcHkpO1xuICBjb25zb2xlLmxvZyhcImVudHJvcHkgOiB2ZXJpZmllZFwiKTtcbn1cblxuLy8gLS1lbnRyb3B5LWluZGV4XG5pZiAocGFyc2VkQXJnc1tcImVudHJvcHktaW5kZXhcIl0pIHtcbiAgY29uc3QgcGFyZW50Q29tbWl0SWQgPSBEZW5vLmVudi5nZXQoXCJQQVJFTlRfQ09NTUlUX0lEXCIpIHx8IFwiXCI7XG5cbiAgaWYgKCFTSEExX1JFR0VYLnRlc3QocGFyZW50Q29tbWl0SWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJpbnZhbGlkIFBBUkVOVF9DT01NSVRfSUQgZW52aXJvbm1lbnQgdmFyaWFibGUsIG11c3QgYmUgU0hBMSBjb21taXQgSURcIixcbiAgICApO1xuICB9XG5cbiAgLy8gQ2FuJ3QgaW5kZXggd2l0aG91dCBhIHByZXZpb3VzIGZpbGUgd2hpY2ggY29udGFpbnMgdGhlIGhhc2ggdG8gaW5kZXggdG9cbiAgY29uc3QgcHJldkVudHJvcHkgPSBhd2FpdCByZWFkSlNPTihQUkVWX0VOVFJPUFlfRklMRSk7XG4gIGlmIChwcmV2RW50cm9weSkge1xuICAgIGNvbnN0IHByZXZFbnRyb3B5SGFzaCA9IHByZXZFbnRyb3B5Py5oYXNoO1xuXG4gICAgaWYgKCFwcmV2RW50cm9weUhhc2ggfHwgIVNIQTI1Nl9SRUdFWC50ZXN0KHByZXZFbnRyb3B5SGFzaCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIm1pc3Npbmcgb3IgaW52YWxpZCBlbnRyb3B5IGhhc2ggaW4gZmlsZVwiKTtcbiAgICB9XG5cbiAgICBEZW5vLm1rZGlyU3luYyhJTkRFWF9ESVIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGF3YWl0IHdyaXRlSlNPTihgJHtJTkRFWF9ESVJ9LyR7cHJldkVudHJvcHlIYXNofS5qc29uYCwge1xuICAgICAgaWQ6IHBhcmVudENvbW1pdElkLFxuICAgIH0pO1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYGVudHJvcHktaW5kZXggOiBpbmRleCBmaWxlIHdyaXR0ZW4gOiAnJHtJTkRFWF9ESVJ9LyR7cHJldkVudHJvcHlIYXNofS5qc29uJyA6ICR7cGFyZW50Q29tbWl0SWR9YCxcbiAgICApO1xuICB9XG59XG5cbi8vIC0tZW50cm9weS11cGxvYWQta3ZcbmlmIChwYXJzZWRBcmdzW1wiZW50cm9weS11cGxvYWQta3ZcIl0pIHtcbiAgY29uc3QgYWNjb3VudElkZW50aWZpZXIgPSBEZW5vLmVudi5nZXQoJ0NGX0FDQ09VTlRfSUQnKVxuICBjb25zdCBuYW1lc3BhY2VJZGVudGlmaWVyID0gRGVuby5lbnYuZ2V0KCdDRl9OQU1FU1BBQ0VfSUQnKVxuICBjb25zdCBrZXlOYW1lID0gXCJsYXRlc3RcIlxuICBjb25zdCBleHBpcmF0aW9uVHRsID0gNjAgKiA2XG4gIGNvbnN0IGF1dGhFbWFpbCA9IERlbm8uZW52LmdldCgnQ0ZfQVVUSF9FTUFJTCcpIHx8ICcnXG4gIGNvbnN0IGF1dGhLZXkgPSBEZW5vLmVudi5nZXQoJ0NGX0FVVEhfS0VZJykgfHwgJydcbiAgY29uc3QgdXJsID0gYGh0dHBzOi8vYXBpLmNsb3VkZmxhcmUuY29tL2NsaWVudC92NC9hY2NvdW50cy8ke2FjY291bnRJZGVudGlmaWVyfS9zdG9yYWdlL2t2L25hbWVzcGFjZXMvJHtuYW1lc3BhY2VJZGVudGlmaWVyfS92YWx1ZXMvJHtrZXlOYW1lfT9leHBpcmF0aW9uX3R0bD0ke2V4cGlyYXRpb25UdGx9YFxuICBjb25zdCBlbnRyb3B5RmlsZSA9IGF3YWl0IHJlYWRKU09OKEVOVFJPUFlfRklMRSlcblxuICBpZiAoZW50cm9weUZpbGUpIHtcbiAgICBsZXQganNvblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiUFVUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBcIlgtQXV0aC1FbWFpbFwiOiBhdXRoRW1haWwsXG4gICAgICAgICAgXCJYLUF1dGgtS2V5XCI6IGF1dGhLZXksXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGVudHJvcHlGaWxlKSxcbiAgICAgIH0pO1xuICAgICAganNvbiA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgZW50cm9weS11cGxvYWQta3YgOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuXG4gICAgaWYgKGpzb24uc3VjY2Vzcykge1xuICAgICAgLy8gRklYTUUgOiBjYWxsIEJldHRlclVwdGltZSBoZWFydGJlYXQgdG8gbG9nIHN1Y2Nlc3NmdWwgY29tcGxldGlvblxuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBlbnRyb3B5LXVwbG9hZC1rdiA6IHN1Y2Nlc3MgOiBsYXRlc3QgZW50cm9weS5qc29uIGZpbGUgd3JpdHRlbiB0byBDbG91ZGZsYXJlIEtWIDogJHtKU09OLnN0cmluZ2lmeShqc29uKX1gLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBlbnRyb3B5LXVwbG9hZC1rdiA6IGZhaWxlZCA6IGxhdGVzdCBlbnRyb3B5Lmpzb24gZmlsZSB3YXMgTk9UIHdyaXR0ZW4gdG8gQ2xvdWRmbGFyZSBLViA6ICR7SlNPTi5zdHJpbmdpZnkoanNvbil9YCxcbiAgICAgICk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKGBlbnRyb3B5LXVwbG9hZC1rdiA6IGZhaWxlZCA6IHVuYWJsZSB0byByZWFkIGVudHJvcHkgZmlsZWApXG4gIH1cbn1cbiJdfQ==