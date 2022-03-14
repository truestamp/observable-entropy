import { createHash } from "https://deno.land/std@0.98.0/hash/mod.ts";
import { Status } from "https://deno.land/std@0.129.0/http/http_status.ts"
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

interface JSONFile {
  name: string;
  hash?: string;
  hashType?: string;
}

type JSONFiles = JSONFile[];

type Entropy = {
  files: JSONFiles;
  hashType: string;
  hashIterations: number;
  hash: string;
  prevHash?: string;
  signature?: string;
  createdAt?: string;
};

// deno-lint-ignore no-explicit-any
async function readJSON(path: string): Promise<any | undefined> {
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text);
  } catch (_error) {
    // console.error(_error);
    return undefined;
  }
}

// GET JSON from a URL with a timeout
// https://medium.com/deno-the-complete-reference/fetch-timeout-in-deno-91731bca80a1
export async function get(url: string, timeout = GET_TIMEOUT) {
  // deno-lint-ignore no-explicit-any
  const ret: Record<string, any> = {};
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), timeout);
    const res = await fetch(url, { signal: c.signal });
    clearTimeout(id);
    ret.ok = true;
    ret.data = await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError')
      ret.err = Status.RequestTimeout;
    else
      ret.err = Status.ServiceUnavailable;
  }
  return ret;
}

// PUT JSON to Cloudflare KV with a timeout
async function putKVLatest(body: Record<string, string | number>, timeout = GET_TIMEOUT) {
  const accountIdentifier = Deno.env.get('CF_ACCOUNT_ID')
  const namespaceIdentifier = Deno.env.get('CF_NAMESPACE_ID')
  const keyName = "latest"
  const expirationTtl = 60 * 6
  const authEmail = Deno.env.get('CF_AUTH_EMAIL') || ''
  const authKey = Deno.env.get('CF_AUTH_KEY') || ''
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountIdentifier}/storage/kv/namespaces/${namespaceIdentifier}/values/${keyName}?expiration_ttl=${expirationTtl}`

  // deno-lint-ignore no-explicit-any
  const ret: Record<string, any> = {};
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
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError')
      ret.err = Status.RequestTimeout;
    else
      ret.err = Status.ServiceUnavailable;
  }
  return ret;
}

async function writeJSON(path: string, data: Record<string, unknown>) {
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
}

function getPrivateKey(): string {
  const privKey = Deno.env.get("ED25519_PRIVATE_KEY") || "";
  if (!privKey || privKey === "") {
    throw new Error(
      "missing required environment variable ED25519_PRIVATE_KEY",
    );
  }
  return privKey;
}

async function getPublicKey(): Promise<string | undefined> {
  const publicKey = await retryAsync(
    async () => {
      console.log("verify : retrieve public key");

      const resp = await get("https://entropy.truestamp.com/pubkey")
      if (resp.err) {
        throw new Error(`failed to fetch : status code ${resp.err}`);
      }

      const { data: publicKeyObj } = resp

      const publicKey = publicKeyObj?.key;
      if (!publicKey || publicKey === "") {
        throw new Error(
          "failed to retrieve required ed25519 public key from https://entropy.truestamp.com/pubkey",
        );
      }
      return publicKey;
    },
    { delay: 1000, maxTry: 3 },
  );

  return publicKey;
}

// Find all *.json files in this dir for hashing.
// Includes the previous entropy file but not the current one.
const getFiles = (): JSONFiles => {
  const files: JSONFiles = [];

  // collect the '.json' files from dir
  for (const dirEntry of Deno.readDirSync(ENTROPY_DIR)) {
    if (
      dirEntry.isFile && dirEntry.name.endsWith(".json")
    ) {
      files.push({ name: dirEntry.name });
    }
  }

  // calculate the hash of each file
  files.map((file) => {
    const data = Deno.readFileSync(`${ENTROPY_DIR}/${file.name}`);
    const hash = createHash(HASH_TYPE);
    hash.update(data);
    file.hash = hash.toString();
    file.hashType = HASH_TYPE;
    return file;
  });

  // sort Array of Objects by file name so the sort order and resultant hash is deterministic
  const sortedFiles = files.sort(function (a, b) {
    const nameA = a.name.toUpperCase(); // ignore upper and lowercase
    const nameB = b.name.toUpperCase(); // ignore upper and lowercase
    if (nameA < nameB) {
      return -1; //nameA comes first
    }
    if (nameA > nameB) {
      return 1; // nameB comes first
    }
    return 0; // names must be equal
  });

  return sortedFiles;
};

// concatenate all of the individual files hashes into one long hash string
const concatenateFileHashes = (files: JSONFiles): string => {
  const hashes = [];
  for (const file of files) {
    hashes.push(file.hash);
  }
  return hashes.join("");
};

// generate a new hash slowly (naïve unicorn style 'sloth' function)
const genSlowHash = (hash: string): string => {
  let newHash = hash;

  for (let i = 0; i < HASH_ITERATIONS; i++) {
    const hash = createHash(HASH_TYPE);
    hash.update(newHash);
    newHash = hash.toString();
  }

  return newHash;
};

const genEntropy = async (): Promise<Entropy> => {
  const files = getFiles();
  const concatenatedFileHashes = concatenateFileHashes(files);
  const slowHash = genSlowHash(concatenatedFileHashes);

  const entropy: Entropy = {
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

// CLI Argument Handler
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

// CLEANUP
// ------------------

// --clean
if (parsedArgs["clean"]) {
  console.log("clean");
  // Cleanup any collected *.json files (for development)
  for (const dirEntry of Deno.readDirSync(".")) {
    if (
      dirEntry.isFile && dirEntry.name.endsWith(".json") &&
      dirEntry.name !== ENTROPY_FILE &&
      dirEntry.name !== DENO_LOCK_FILE
    ) {
      Deno.removeSync(dirEntry.name);
    }
  }
}

// ENTROPY COLLECTION
// ------------------

// Each collection source will be retried on failure, but if it
// finally still raises an error it will just be logged and this
// source will be skipped.

// TIMESTAMP
if (parsedArgs["collect"] || parsedArgs["collect-timestamp"]) {
  await retryAsync(
    async () => {
      console.log("collect attempt : timestamp");
      ensureDirSync(ENTROPY_DIR);
      await writeJSON(`${ENTROPY_DIR}/timestamp.json`, {
        timestamp: NOW.toISOString(),
      });
    },
    { delay: 1000, maxTry: 3 },
  );
}

// BITCOIN
if (parsedArgs["collect"] || parsedArgs["collect-bitcoin"]) {
  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : bitcoin");

        const resp = await get("https://blockchain.info/latestblock")
        if (resp.err) {
          throw new Error(`failed to fetch : status code ${resp.err}`);
        }

        const { data } = resp

        // extract just the data we want
        const { height, hash, time, block_index: blockIndex } = data;
        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/bitcoin.json`, {
          height,
          hash,
          time,
          blockIndex,
        });
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect bitcoin tooManyTries : ${error.message}`);
    } else {
      console.error(`collect bitcoin failed : ${error.message}`);
    }
  }
}

// ETHEREUM
if (parsedArgs["collect"] || parsedArgs["collect-ethereum"]) {
  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : ethereum");

        const resp = await get("https://api.blockcypher.com/v1/eth/main")
        if (resp.err) {
          throw new Error(`failed to fetch : status code ${resp.err}`);
        }

        const { data } = resp

        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/ethereum.json`, data);
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect ethereum tooManyTries : ${error.message}`);
    } else {
      console.error(`collect ethereum failed : ${error.message}`);
    }
  }
}

// NIST BEACON
if (parsedArgs["collect"] || parsedArgs["collect-nist"]) {
  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : nist-beacon");

        const resp = await get("https://beacon.nist.gov/beacon/2.0/pulse/last")
        if (resp.err) {
          throw new Error(`failed to fetch : status code ${resp.err}`);
        }

        const { data } = resp

        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/nist-beacon.json`, data);
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect nist-beacon tooManyTries : ${error.message}`);
    } else {
      console.error(`collect nist-beacon failed : ${error.message}`);
    }
  }
}

// USER ENTROPY
if (parsedArgs["collect"] || parsedArgs["collect-user-entropy"]) {
  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : user-entropy");

        const resp = await get("https://entropy.truestamp.com/entries")
        if (resp.err) {
          throw new Error(`failed to fetch : status code ${resp.err}`);
        }

        const { data } = resp

        if (!Array.isArray(data)) {
          throw new Error(
            `collect attempt : user-entropy : expected Array, got ${data}`,
          );
        }

        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/user-entropy.json`, { data });
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect user-entropy tooManyTries : ${error.message}`);
    } else {
      console.error(`collect user-entropy failed : ${error.message}`);
    }
  }
}

// STELLAR
if (parsedArgs["collect"] || parsedArgs["collect-stellar"]) {
  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : stellar");
        // Retrieve the last ledger ID.
        // curl -X GET "https://horizon.stellar.org/fee_stats" > stellar-fee-stats.json

        const respStats = await get("https://horizon.stellar.org/fee_stats")
        if (respStats.err) {
          throw new Error(`failed to fetch : status code ${respStats.err}`);
        }

        const { data: feeStats } = respStats

        // Read the ledger for last ledger ID
        const respLedger = await get(`https://horizon.stellar.org/ledgers/${feeStats.last_ledger}`)
        if (respLedger.err) {
          throw new Error(`failed to fetch : status code ${respLedger.err}`);
        }

        const { data: latestLedger } = respLedger

        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/stellar.json`, latestLedger);
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect stellar tooManyTries : ${error.message}`);
    } else {
      console.error(`collect stellar failed : ${error.message}`);
    }
  }
}

// DRAND BEACON
if (parsedArgs["collect"] || parsedArgs["collect-drand"]) {
  // Drand Beacon
  // https://drand.love/developer/http-api/#public-endpoints
  // https://github.com/drand/drand-client

  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : drand-beacon");
        const urls = [
          "https://drand.cloudflare.com",
        ];

        const resp = await get("https://drand.cloudflare.com/info")
        if (resp.err) {
          throw new Error(`failed to fetch : status code ${resp.err}`);
        }

        const { data: chainInfo } = resp

        const options = { chainInfo };

        const client = await Client.wrap(
          HTTP.forURLs(urls, chainInfo.hash),
          options,
        );

        const randomness = await client.get();

        await client.close();

        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/drand-beacon.json`, {
          chainInfo,
          randomness,
        });
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect drand tooManyTries : ${error.message}`);
    } else {
      console.error(`collect drand failed : ${error.message}`);
    }
  }
}

// HACKER NEWS
if (parsedArgs["collect"] || parsedArgs["collect-hn"]) {
  // Hacker News API: https://github.com/HackerNews/API

  try {
    await retryAsync(
      async () => {
        console.log("collect attempt : hacker-news");

        const resp = await get("https://hacker-news.firebaseio.com/v0/newstories.json")
        if (resp.err) {
          throw new Error(`failed to fetch : status code ${resp.err}`);
        }

        const { data: newsStories } = resp

        const stories = [];

        for (let i = 0; i < 10; i++) {
          const respStory = await get(`https://hacker-news.firebaseio.com/v0/item/${newsStories[i]}.json`)
          if (respStory.err) {
            throw new Error(`failed to fetch : status code ${respStory.err}`);
          }

          const { data: story } = respStory

          stories.push(story);
        }

        ensureDirSync(ENTROPY_DIR);
        await writeJSON(`${ENTROPY_DIR}/hacker-news.json`, { stories });
      },
      { delay: 1000, maxTry: 3 },
    );
  } catch (error) {
    if (isTooManyTries(error)) {
      // Did not collect after 'maxTry' calls
      console.error(`collect hacker news tooManyTries : ${error.message}`);
    } else {
      console.error(`collect hacker news failed : ${error.message}`);
    }
  }
}

// ENTROPY GENERATION
// ------------------

// --entropy-generate
if (parsedArgs["entropy-generate"]) {
  // Copy existing entropy file to prev version
  if (await readJSON(ENTROPY_FILE)) {
    Deno.copyFileSync(ENTROPY_FILE, PREV_ENTROPY_FILE);
    console.log(`entropy : copied to '${PREV_ENTROPY_FILE}'`);
  }

  // Generate and overwrite entropy file
  const entropy = await genEntropy();
  await writeJSON(ENTROPY_FILE, entropy);
  console.log("entropy : generated");
}

// --entropy-verify
if (parsedArgs["entropy-verify"]) {
  // Compare newly calculated results to what's already been written (excluding the createdAt property)

  const currentEntropy = await readJSON(ENTROPY_FILE);
  if (!currentEntropy) {
    throw new Error(`required file '${ENTROPY_FILE}' not found`);
  }

  const publicKey = await getPublicKey();

  if (!publicKey) {
    throw new Error("unable to retrieve public key for verification");
  }

  if (
    !await ed.verify(
      currentEntropy.signature,
      currentEntropy.hash,
      publicKey,
    )
  ) {
    throw new Error("invalid hash signature");
  }

  const entropy = await genEntropy();
  // Ignore the created_at in the committed vs current JSON comparison
  // this will always be different between creation and verification.
  delete currentEntropy.createdAt;
  delete entropy.createdAt;
  assertObjectMatch(currentEntropy, entropy);
  console.log("entropy : verified");
}

// --entropy-index
if (parsedArgs["entropy-index"]) {
  const parentCommitId = Deno.env.get("PARENT_COMMIT_ID") || "";

  if (!SHA1_REGEX.test(parentCommitId)) {
    throw new Error(
      "invalid PARENT_COMMIT_ID environment variable, must be SHA1 commit ID",
    );
  }

  // Can't index without a previous file which contains the hash to index to
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
    console.log(
      `entropy-index : index file written : '${INDEX_DIR}/${prevEntropyHash}.json' : ${parentCommitId}`,
    );
  }
}

// --entropy-upload-kv
if (parsedArgs["entropy-upload-kv"]) {
  const entropyFile = await readJSON(ENTROPY_FILE)

  if (entropyFile) {
    try {
      await retryAsync(
        async () => {
          console.log("entropy-upload-kv : PUT");

          const ret = await putKVLatest(entropyFile)

          if (ret?.ok) {
            console.log(
              `entropy-upload-kv : success : latest entropy.json file written to Cloudflare KV : ${JSON.stringify(ret.data)}`,
            );

            // If a heartbeat URL was provided, call it with timeout
            const heartbeatUrl = Deno.env.get('BETTER_UPTIME_HEARTBEAT_URL')
            if (heartbeatUrl) {
              try {
                const hb = await get(heartbeatUrl)
                if (hb?.ok) {
                  console.log(
                    `entropy-upload-kv : success : better uptime heartbeat logged`,
                  );
                }
              } catch (error) {
                console.error(`better uptime heartbeat failed : ${error.message}`)
              }
            } else {
              console.log(
                `entropy-upload-kv : success : better uptime heartbeat not logged : no BETTER_UPTIME_HEARTBEAT_URL provided`,
              );
            }
          } else {
            console.log(
              `entropy-upload-kv : failed : latest entropy.json file was NOT written to Cloudflare KV : ${JSON.stringify(ret.data)}`,
            );
          }
        },
        { delay: 1000, maxTry: 3 },
      );
    } catch (error) {
      if (isTooManyTries(error)) {
        // Failed to submit entropy-upload-kv after 'maxTry' calls
        console.error(`entropy-upload-kv tooManyTries : ${error.message}`);
      } else {
        console.error(`entropy-upload-kv failed : ${error.message}`);
      }
    }
  } else {
    console.warn(`entropy-upload-kv : failed : unable to read entropy file`)
  }
}
