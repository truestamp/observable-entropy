# Observable Entropy

![Collect Entropy](https://github.com/truestamp/observable-entropy/actions/workflows/entropy.yml/badge.svg)

:eye: :game_die:

Incontestable and verifiable public randomness is a powerful tool that is useful
for a wide variety of use cases. The Observable Entropy project collects public,
and preferably verifiable, sources of randomness and processes them into a
single SHA-256 hash that is independently verifiable to represent the totality
of the collected entropy. Through the capability for anyone to contribute their
own entropy to the process, this randomness can be used safely even if you are
deeply paranoid and the only source you trust is yourself.

The process of generating incontestable random data is deterministic and
reproducible by anyone by simply cloning this repository and running a single
command. Most of the public data collected is itself verifiable against its
source, and it is easy for you to confirm that final entropy data hash is in
fact derived from the data collected and stored in the repository. With one
additional simple step, the verification process can even be run while
disconnected from the network.

The addition, or removal, of public entropy sources over time, or even a change
in the incontestable random entropy generation protocol, should have no effect
on the verifiability of any previously collected data as the verification script
is co-located with its data.

All entropy provided by the system is signed with an `ed25519` signature for
verification of the creator. The integrity of both the git commit history, and
the hash chained entropy stored within it, are also independently verifiable.

## Experimental

This is an early release of incontestable public entropy collection and
processing software. While the collection and hashing processes are inherently
simple and reliable (the entirety of the data collection, entropy generation,
verification, and job management code is ~500 LOC), the entropy collection may
fail to run, may fail to run on schedule, or may fail to collect the appropriate
data. Proceed with caution.

## WARNING

DO NOT use any values found in this repository as encryption keys or passwords!
They are all public values and are therefore wholly unsuited for that purpose.
You have been warned!

## TL;DR : Give me the data

If you came here seeking an easy way to use verifiably random data, the public
API (which is just a Cloudflare worker HTTP proxy into the raw contents of this
repository) makes it easy.

### Latest

Returns the latest `entropy.json` file.

[https://entropy.truestamp.com/latest](https://entropy.truestamp.com/latest)

### Lookup by Git commit ID (`sha1`)

Returns the contents of `entropy.json` as committed in `id`.

`https://entropy.truestamp.com/commit/:id`

[https://entropy.truestamp.com/commit/3ba7090bad4d16ac362505b14f71e6e7008146c6](https://entropy.truestamp.com/commit/3ba7090bad4d16ac362505b14f71e6e7008146c6)

### Lookup by Entropy Hash (`sha256`)

Returns the contents of the `entropy.json` that has a specific entropy `hash`
value.

`https://entropy.truestamp.com/hash/:hash`

[https://entropy.truestamp.com/hash/2f51d1dbb3213ee2be0a774be7c9979f42d93b1d4f7013257de81fefa0ef4349](https://entropy.truestamp.com/hash/2f51d1dbb3213ee2be0a774be7c9979f42d93b1d4f7013257de81fefa0ef4349)

## Why do we need incontestable randomness?

This project was in-part inspired by the presentation
[TRUST, AND PUBLIC ENTROPY: A UNICORN
HUNT](https://csrc.nist.gov/csrc/media/events/random-bit-generation-workshop-2016/documents/presentations/sessionv-3-benjamin-wesolowski-presentation.pdf)
and the associated paper
[A random zoo: sloth, unicorn, and trx](https://eprint.iacr.org/2015/366).

The paper describes the properties of incontestable random numbers as:

1. Open protocol: anyone is able to take part in the generation process (and it
   is very easy)
2. Verifiable: anyone can verify everything went right
3. Secure: even if only one single participant is honest (and that can be you,
   thanks to 1.)

Among other uses, when included in the process of publishing data (or the hash
of some data), it can be useful to prove that something was **published** after
a specific point in time. A subtle distinction is that it does not prove
something was **created** after a moment in time (although that may also be
true). For example, if I published the collected works of Shakespeare and
included the latest Entropy hash along with it, it would only prove that I
published the data after the entropy hash was generated, not that I created the
works after that point in time.

There are **many** other uses for provably random data. For some further reading
take a look at:

- [Trust and Public Entropy : A Unicorn
  Hunt](https://csrc.nist.gov/csrc/media/events/random-bit-generation-workshop-2016/documents/presentations/sessionv-3-benjamin-wesolowski-presentation.pdf)
- [Randomness 101 : Lavarand in Production](https://blog.cloudflare.com/randomness-101-lavarand-in-production/)
- [League of Entropy : Making randomness truly
  random](https://onezero.medium.com/the-league-of-entropy-is-making-randomness-truly-random-522f22ce93ce)
- [Why are countries creating public random number
  generators?](https://www.sciencemag.org/news/2018/06/why-are-countries-creating-public-random-number-generators)
- [On Bitcoin as a Public Randomness
  Source](https://eprint.iacr.org/2015/1015.pdf)
- [Cryptographic Beacons (a.k.a. Randomness
  Beacons)](http://www.copenhagen-interpretation.com/home/cryptography/cryptographic-beacons)

### "Proof of Life" Example

An old trope often seen in the movies is the one where a kidnap victim is
photographed with a current newspaper as "proof of life". The idea being that if
the victim is seemingly alive and well in the photo, and the photo can be
reliably verified to have been taken after the headlines in the paper were
written, then the victim is presumed OK at _that_ moment in time. The smaller
the window of time between the headline and now, the better.

[![image alt text](assets/cage-proof-of-life.jpeg)](https://twitter.com/mashant/status/946734525392015360)

[Was Nicholas cage in peril?](https://twitter.com/mashant/status/946734525392015360)

When combined with a cryptographic timestamp and provenance commitment system
such as [Truestamp](https://www.truestamp.com) it is now possible to prove that
any data was committed during a window of time that is **after** the specific
point in time `A` when the incontestable entropy hash was created, and **prior**
to another specific point in time `B` when this data was committed with a public
blockchain with a secure and verifiable timestamp.

```txt
Time ----->

Published Headline  -->  [Headline | Nick Cage]  --> Photo Published

EntropyHash@A  -->  [Entropy Hash@A | DATA]  --> Written to Blockchain
```

## Public Entropy Sources

The first, and most important step in the process is to collect data from
public, preferably strongly verifiable, sources of randomness.

The following sources are currently attempted to be collected. If the collection
of any individual source fails, or produces exactly the same data as was already
stored in the previous commit, it should result in no change for that source as
written to disk.

### Bitcoin Blockchain

Verifiable source: `true`

The latest block header info as provided by the
`https://blockchain.info/latestblock` API.

The Bitcoin block data can be independently verified by visiting the
[blockchain.com](https://www.blockchain.com/explorer?view=btc) block explorer
(or another of your choosing).

Using the `hash` value from the stored `bitcoin.json` file you can visit a URL
with info about that block:

Example:

[https://www.blockchain.com/btc/block/000000000000000000073e1f0e0ad829aec961c29e1ef8d632ee55401fc248ec](https://www.blockchain.com/btc/block/000000000000000000073e1f0e0ad829aec961c29e1ef8d632ee55401fc248ec)

### Drand Random Beacon

Verifiable source: `true`

The latest random data generated by [Drand](https://drand.love/), which provides
"Verifiable, unpredictable and unbiased random numbers as a service".

The Drand beacon data can be independently verified using the Rust
[drand-verify](https://github.com/CosmWasm/drand-verify) tool and passing it the
`round`, `previous_signature`, and `signature` values from `drand-beacon.json`.

Example:

```sh
$ cargo run --example drand_verify 982693 a1b1adf7f7dd1ca61d1772859991fd68fb4bd282622247b41cc483476f4d16d8d862fcb5c518d21e11b12d44480e631604326bd9a5c385f634782152a10df702386bf30d77e9cdc96f42b0c29bb0696aecc5a4ab5987a396a8007a6867e2c8e5 961f28f2fc98e1a150d198a26d14b481fb6def08b5b8a5312dec22117f063a39b99d892f54231dbb260bb09771647c3d056d0bb20919175eb121f1092b7d8499818ebd7ccdf87fb9f8da60cd29eab975516c4b9331199d32c1ea6bc010cfc954
    Finished dev [unoptimized + debuginfo] target(s) in 0.06s
     Running `target/debug/examples/drand_verify 982693 a1b1adf7f7dd1ca61d1772859991fd68fb4bd282622247b41cc483476f4d16d8d862fcb5c518d21e11b12d44480e631604326bd9a5c385f634782152a10df702386bf30d77e9cdc96f42b0c29bb0696aecc5a4ab5987a396a8007a6867e2c8e5 961f28f2fc98e1a150d198a26d14b481fb6def08b5b8a5312dec22117f063a39b99d892f54231dbb260bb09771647c3d056d0bb20919175eb121f1092b7d8499818ebd7ccdf87fb9f8da60cd29eab975516c4b9331199d32c1ea6bc010cfc954`
Verification succeeded
Randomness: 92577f74a8bd0617c48f6e8bf14fa8b04daaded87b5d2d7b0a5aafb89f403a6d
```

More information:

- [League of Entropy](https://www.cloudflare.com/leagueofentropy/)
- [League of Entropy: Not All Heroes Wear
  Capes](https://blog.cloudflare.com/league-of-entropy/)
- [drand/drand-client](https://github.com/drand/drand-client)

Both the current published Drand chain info, and the public randomness data
generated is collected.

### Ethereum Blockchain

Verifiable source: `true`

The latest block header info as provided by the
`https://api.blockcypher.com/v1/eth/main` API.

The Ethereum block data can be independently verified by visiting the
[blockcypher.com](https://live.blockcypher.com/eth/) block explorer (or another
of your choosing).

Using the `hash` value from the stored `ethereum.json` file you can visit a URL
with info about that block:

Example:

[https://live.blockcypher.com/eth/block/17e369d2546b865cbd7ee8cd69ce4f0c11df451738b23a6bdd4c21dcb0ac6bcf/](https://live.blockcypher.com/eth/block/17e369d2546b865cbd7ee8cd69ce4f0c11df451738b23a6bdd4c21dcb0ac6bcf/)

### Hacker News

Verifiable source: `manually`

The current top 10 news story headlines and links as provided by the
[Hacker News API](https://github.com/HackerNews/API).

This data can be verified by inspecting the content, specifically the headlines
in the stories, and identifying their context in time based on the publish time
of the linked stories and the story context.

### NIST Randomness Beacon

Verifiable source: `true`

The current `pulse` from the
[NIST Randomness Beacon](https://beacon.nist.gov/home) (Version 2.0 Beta).

Detailed info about this beacon can be found in the
[NIST paper : A Reference for Randomness
Beacons](https://nvlpubs.nist.gov/nistpubs/ir/2019/NIST.IR.8213-draft.pdf)

The data provided by the NIST Beacon is independently verifiable using the
`chainIndex` and `pulseIndex` values in the `nist-beacon.json` file.

Verification URL :
`https://beacon.nist.gov/beacon/2.0/chain/<chainIndex>/pulse/<pulseIndex>`

Example:

[https://beacon.nist.gov/beacon/2.0/chain/1/pulse/1442043](https://beacon.nist.gov/beacon/2.0/chain/1/pulse/1442043)

Comparison of the `outputValue`, `signatureValue` and `timeStamp` should be
sufficient, but other data fields can be compared as well. Cryptographic
verification of the pulse signature should be possible as well but is left as an
exercise for the reader.

### Stellar Blockchain

Verifiable source: `true`

The latest Stellar ledger (block) data as collected from the
`https://horizon.stellar.org/fee_stats` and
`https://horizon.stellar.org/ledgers/{ID}` API endpoints.

The `/fee_stats` API is used to identify the latest ledger `ID` and its output
is then discarded.

The `/ledgers` API is then used to retrieve the full ledger data for that `ID`.

The Stellar block stored in `stellar.json` can be independently verified by
extracting the `sequence` number (the block height), and comparing stored values
like the ledger `hash` and `closed_at` timestamp in the file to the "Ledger
hash" and "Closed at" attributes on the page. Other values may be compared as
well.

Example:

Using the `https://stellar.expert/explorer/public/ledger/:ledgerId` URL:

[https://stellar.expert/explorer/public/ledger/36119209](https://stellar.expert/explorer/public/ledger/36119209)

### Timestamp UTC

Verifiable source: `false`

The current `UTC` timestamp in `ISO8601` format from the `deno` runtime on the
server running the collection jobs. This is for convenience and is not
independently verifiable after the fact.

### User Provided Entropy

One of the most interesting aspects of this system is the ability for anyone to
submit their own random entropy right up to the point when entropy is collected.
Any user, with a simple post request, can submit one or more 32 byte hex strings
(64 characters) to a list of user provided entropy. This list will be stored in
the `user-entropy.json` file when it is collected and will contain each of the
random values submitted for this run. At the end of each entropy collection run,
the list will be automatically emptied of all values and you can feel free to
submit again.

This capability was used when the `Genesis` commit was made for this repository.
The user provided entropy fields were seeded with the current value of the
latest Bitcoin block hash, and the latest Stellar ledger hash.

Example Usage:

To provide new entropy for capture on the next run.

Each `POST` request must provide a JSON body object with an `entropy` key:

```json
{
  "entropy": "bdd1d11b1ab7569c40e07a61b5b6071d80efcf5db176d8ab172e15d5566cb342"
}
```

The `entropy` value must be a 32 byte hex string, which can be generated by a
hashing algorithm, or a random number generator. If you have a value that is in
another format it is recommended you hash it with `SHA256` for submittal.

An example method for generating the random hex string is:

```sh
node -e 'console.log(crypto.randomBytes(32).toString("hex"))'
```

The value generated can by submitted with any tool capable of generating a
simple HTTP `POST` request as demonstrated here with the
[HTTPie](https://httpie.io/) tool. You will want to store this value until the
next entropy collection run when you can confirm it has been included in the
`user-entropy.json` file.

```sh
http -v POST https://entropy.truestamp.com/entries entropy=bdd1d11b1ab7569c40e07a61b5b6071d80efcf5db176d8ab172e15d5566cb342
```

You can confirm the list of entropy values prepared for the next entropy
collection with a `GET` request:

```sh
http https://entropy.truestamp.com/entries
```

## Observable Entropy Protocol

### Git Storage

Git is used as the storage mechanism as it is
[content addressable storage](https://www.designveloper.com/blog/hash-values-sha-1-in-git/)
that can be [proven to be valid](https://gist.github.com/masak/2415865).

Anyone is encouraged to periodically sync their own local copy of this
repository to their local system and run the verification.

### Collection and Generation Schedule

An attempt is made to collect data from all sources on a five minute interval.
Once the random data is collected a hash of the contents of each file is
generated and committed.

The status of recent job runs can be viewed in the
[Actions](https://github.com/truestamp/observable-entropy/actions) tab of this
repository.

### Protocol

The current method for deterministically generating the output hash follows
these steps.

Additionally, each newly generated entropy file incorporates the hash of all of
the data in the previous version of the file. This hash-linking prohibits the
modification of this chain. This is in addition to the Git provided commit chain
verification. Here are the steps that are performed, followed by a Git commit.

### Collection

- copy any pre-existing `entropy.json` file to `entropy_previous.json`
- collect data from each public source, and store it in `.json` files,
  overwriting any older data

### Hashing

- identify the file name of any `.json` files in the repo as of the current
  commit
- obtain the `SHA2-256` hash of each of those files
- sort the list alphabetically by file name
- concatenate the `SHA2-256` hash of each ordered file into a single string
- obtain the `SHA2-256` hash of this multiple hash string **slowly** by
  iterating over it a large number of times (currently 500,000), generating a
  new hash from the previous one on each iteration.
- store the new `entropy.json` file data, including files hashes
- run the verification tool to confirm integrity

### Indexing

- Write a physical index file which maps the entropy `hash` value (a `SHA256`
  hash) from the **prior** run to the Git commit ID of that commitment. This
  means that the index is not available until the next commit after each run.

## Verification

The data captured, and the incontestable entropy hash generated from it, is
designed to be easily verifiable by anyone with access to this repository.

The `ed25519` public key signature over the hex `hash` value is also provided in
the `signature` attribute. This signature is always verified and the public key
is retrieved from
[https://entropy.truestamp.com/pubkey](https://entropy.truestamp.com/pubkey).

There are two levels of verification possible:

- manual data comparison against each source of truth as appropriate for its
  type.
- reproducible deterministic verification of the entropy `hash` value.

### Manual Source Verification

The first form of verification is a manual process that the interested user can
follow to compare the data that was captured against one or more sources of
truth. This can test only individual sources to ensure they were not corrupted.

The procedure for verifying individual randomness sources can be found earlier
in this document.

### Deterministic Hash Verification

After the collection of data, all of the data files are processed according to
the protocol outlined earlier. This process can also be run in `make verify`
mode by anyone with a clone of this repository. This allows anyone to confirm
that, given the collected data written in a commit, a known hash will **always**
result when processing all the data in a reproducible way.

The verification process runs all of the same steps In fact the `make verify`
step runs exactly the same code as the original generation, but instead of
writing the `entropy.json` file at the end of the process, it compares the
`hash` generated to the value in the `entropy.json` file on disk. If that
comparison is not an **exact match** the command will fail with a message
indicating why, and will likely indicate which file is to blame.

Since the hashing/verification code, including dependencies, is committed to
this repository it is also true that if this code changes over time it should
not break any earlier commitments. **You should always run the verification code
that is co-committed with the data you are verifying** by checking out the
desired commit. You should avoid extracting the verification code to run outside
of its context in the repository.

#### Example Verification

The only pre-requisite is to have `git`, `make`, and the `deno` runtime
installed by following the
[Deno installation steps](https://deno.land/#installation). `git` and `make` are
installed on most operating systems by default.

```txt
# Clone the repo
git clone https://github.com/truestamp/observable-entropy.git

# Change directory
cd observable-entropy

# Optionally, run a full integrity check on your cloned repo
# https://www.linux.org/docs/man1/git-fsck.html
git fsck --full --strict

# Checkout a branch representing a hash commit
# (identified by presence of entropy.json file)
# Replace GIT_COMMIT_SHA1 with the commit you
# want to verify. This will leave you in a working
# dir that contains the contents of that commit in a
# 'detached HEAD' state.
git checkout [GIT_COMMIT_SHA1]

# Run the verification script and view its output
# A verification failure will throw an error message.
make verify

# Return Git from 'detached HEAD' state, back to main branch.
git checkout main
```
