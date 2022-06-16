// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { crypto as wasmCrypto, digestAlgorithms } from "../../_wasm_crypto/mod.ts";
import { Buffer } from "../buffer.ts";
import { Transform } from "../stream.ts";
import { encode as encodeToHex } from "../../encoding/hex.ts";
import { encode as encodeToBase64 } from "../../encoding/base64.ts";
const coerceToBytes = (data)=>{
    if (data instanceof Uint8Array) {
        return data;
    } else if (typeof data === "string") {
        // This assumes UTF-8, which may not be correct.
        return new TextEncoder().encode(data);
    } else if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    } else {
        throw new TypeError("expected data to be string | BufferSource");
    }
};
/**
 * The Hash class is a utility for creating hash digests of data. It can be used in one of two ways:
 *
 * - As a stream that is both readable and writable, where data is written to produce a computed hash digest on the readable side, or
 * - Using the hash.update() and hash.digest() methods to produce the computed hash.
 *
 * The crypto.createHash() method is used to create Hash instances. Hash objects are not to be created directly using the new keyword.
 */ export class Hash extends Transform {
    #context;
    constructor(algorithm, _opts){
        super({
            transform (chunk, _encoding, callback) {
                context.update(coerceToBytes(chunk));
                callback();
            },
            flush (callback) {
                this.push(context.digest(undefined));
                callback();
            }
        });
        if (typeof algorithm === "string") {
            // Node/OpenSSL and WebCrypto format some digest names differently;
            // we attempt to handle those here.
            algorithm = algorithm.toUpperCase();
            if (opensslToWebCryptoDigestNames[algorithm]) {
                algorithm = opensslToWebCryptoDigestNames[algorithm];
            }
            this.#context = new wasmCrypto.DigestContext(algorithm);
        } else {
            this.#context = algorithm;
        }
        const context = this.#context;
    }
    copy() {
        return new Hash(this.#context.clone());
    }
    /**
   * Updates the hash content with the given data.
   */ update(data, _encoding) {
        let bytes;
        if (typeof data === "string") {
            data = new TextEncoder().encode(data);
            bytes = coerceToBytes(data);
        } else {
            bytes = coerceToBytes(data);
        }
        this.#context.update(bytes);
        return this;
    }
    /**
   * Calculates the digest of all of the data.
   *
   * If encoding is provided a string will be returned; otherwise a Buffer is returned.
   *
   * Supported encoding is currently 'hex', 'binary', 'base64'.
   */ digest(encoding) {
        const digest = this.#context.digest(undefined);
        if (encoding === undefined) {
            return Buffer.from(digest);
        }
        switch(encoding){
            case "hex":
                return new TextDecoder().decode(encodeToHex(new Uint8Array(digest)));
            case "binary":
                return String.fromCharCode(...digest);
            case "base64":
                return encodeToBase64(digest);
            default:
                throw new Error(`The output encoding for hash digest is not implemented: ${encoding}`);
        }
    }
}
/**
 * Supported digest names that OpenSSL/Node and WebCrypto identify differently.
 */ const opensslToWebCryptoDigestNames = {
    BLAKE2B512: "BLAKE2B",
    BLAKE2S256: "BLAKE2S",
    RIPEMD160: "RIPEMD-160",
    RMD160: "RIPEMD-160",
    SHA1: "SHA-1",
    SHA224: "SHA-224",
    SHA256: "SHA-256",
    SHA384: "SHA-384",
    SHA512: "SHA-512"
};
/**
 * Creates and returns a Hash object that can be used to generate hash digests
 * using the given `algorithm`. Optional `options` argument controls stream behavior.
 */ export function createHash(algorithm, opts) {
    return new Hash(algorithm, opts);
}
/**
 * Returns an array of the names of the supported hash algorithms, such as 'sha1'.
 */ export function getHashes() {
    return digestAlgorithms;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvX2NyeXB0by9oYXNoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBOb2RlLmpzIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB7XG4gIGNyeXB0byBhcyB3YXNtQ3J5cHRvLFxuICBEaWdlc3RBbGdvcml0aG0sXG4gIGRpZ2VzdEFsZ29yaXRobXMsXG59IGZyb20gXCIuLi8uLi9fd2FzbV9jcnlwdG8vbW9kLnRzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBUcmFuc2Zvcm0gfSBmcm9tIFwiLi4vc3RyZWFtLnRzXCI7XG5pbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlVG9IZXggfSBmcm9tIFwiLi4vLi4vZW5jb2RpbmcvaGV4LnRzXCI7XG5pbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlVG9CYXNlNjQgfSBmcm9tIFwiLi4vLi4vZW5jb2RpbmcvYmFzZTY0LnRzXCI7XG5pbXBvcnQgdHlwZSB7IFRyYW5zZm9ybU9wdGlvbnMgfSBmcm9tIFwiLi4vX3N0cmVhbS5kLnRzXCI7XG5cbmNvbnN0IGNvZXJjZVRvQnl0ZXMgPSAoZGF0YTogc3RyaW5nIHwgQnVmZmVyU291cmNlKTogVWludDhBcnJheSA9PiB7XG4gIGlmIChkYXRhIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgIHJldHVybiBkYXRhO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gVGhpcyBhc3N1bWVzIFVURi04LCB3aGljaCBtYXkgbm90IGJlIGNvcnJlY3QuXG4gICAgcmV0dXJuIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShkYXRhKTtcbiAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoZGF0YSkpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCwgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgfSBlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImV4cGVjdGVkIGRhdGEgdG8gYmUgc3RyaW5nIHwgQnVmZmVyU291cmNlXCIpO1xuICB9XG59O1xuXG4vKipcbiAqIFRoZSBIYXNoIGNsYXNzIGlzIGEgdXRpbGl0eSBmb3IgY3JlYXRpbmcgaGFzaCBkaWdlc3RzIG9mIGRhdGEuIEl0IGNhbiBiZSB1c2VkIGluIG9uZSBvZiB0d28gd2F5czpcbiAqXG4gKiAtIEFzIGEgc3RyZWFtIHRoYXQgaXMgYm90aCByZWFkYWJsZSBhbmQgd3JpdGFibGUsIHdoZXJlIGRhdGEgaXMgd3JpdHRlbiB0byBwcm9kdWNlIGEgY29tcHV0ZWQgaGFzaCBkaWdlc3Qgb24gdGhlIHJlYWRhYmxlIHNpZGUsIG9yXG4gKiAtIFVzaW5nIHRoZSBoYXNoLnVwZGF0ZSgpIGFuZCBoYXNoLmRpZ2VzdCgpIG1ldGhvZHMgdG8gcHJvZHVjZSB0aGUgY29tcHV0ZWQgaGFzaC5cbiAqXG4gKiBUaGUgY3J5cHRvLmNyZWF0ZUhhc2goKSBtZXRob2QgaXMgdXNlZCB0byBjcmVhdGUgSGFzaCBpbnN0YW5jZXMuIEhhc2ggb2JqZWN0cyBhcmUgbm90IHRvIGJlIGNyZWF0ZWQgZGlyZWN0bHkgdXNpbmcgdGhlIG5ldyBrZXl3b3JkLlxuICovXG5leHBvcnQgY2xhc3MgSGFzaCBleHRlbmRzIFRyYW5zZm9ybSB7XG4gICNjb250ZXh0OiB3YXNtQ3J5cHRvLkRpZ2VzdENvbnRleHQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYWxnb3JpdGhtOiBzdHJpbmcgfCB3YXNtQ3J5cHRvLkRpZ2VzdENvbnRleHQsXG4gICAgX29wdHM/OiBUcmFuc2Zvcm1PcHRpb25zLFxuICApIHtcbiAgICBzdXBlcih7XG4gICAgICB0cmFuc2Zvcm0oY2h1bms6IHN0cmluZywgX2VuY29kaW5nOiBzdHJpbmcsIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgICAgIGNvbnRleHQudXBkYXRlKGNvZXJjZVRvQnl0ZXMoY2h1bmspKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgIH0sXG4gICAgICBmbHVzaChjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgICAgICB0aGlzLnB1c2goY29udGV4dC5kaWdlc3QodW5kZWZpbmVkKSk7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHR5cGVvZiBhbGdvcml0aG0gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIC8vIE5vZGUvT3BlblNTTCBhbmQgV2ViQ3J5cHRvIGZvcm1hdCBzb21lIGRpZ2VzdCBuYW1lcyBkaWZmZXJlbnRseTtcbiAgICAgIC8vIHdlIGF0dGVtcHQgdG8gaGFuZGxlIHRob3NlIGhlcmUuXG4gICAgICBhbGdvcml0aG0gPSBhbGdvcml0aG0udG9VcHBlckNhc2UoKTtcbiAgICAgIGlmIChvcGVuc3NsVG9XZWJDcnlwdG9EaWdlc3ROYW1lc1thbGdvcml0aG1dKSB7XG4gICAgICAgIGFsZ29yaXRobSA9IG9wZW5zc2xUb1dlYkNyeXB0b0RpZ2VzdE5hbWVzW2FsZ29yaXRobV07XG4gICAgICB9XG4gICAgICB0aGlzLiNjb250ZXh0ID0gbmV3IHdhc21DcnlwdG8uRGlnZXN0Q29udGV4dChcbiAgICAgICAgYWxnb3JpdGhtIGFzIERpZ2VzdEFsZ29yaXRobSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuI2NvbnRleHQgPSBhbGdvcml0aG07XG4gICAgfVxuXG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMuI2NvbnRleHQ7XG4gIH1cblxuICBjb3B5KCk6IEhhc2gge1xuICAgIHJldHVybiBuZXcgSGFzaCh0aGlzLiNjb250ZXh0LmNsb25lKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIGhhc2ggY29udGVudCB3aXRoIHRoZSBnaXZlbiBkYXRhLlxuICAgKi9cbiAgdXBkYXRlKGRhdGE6IHN0cmluZyB8IEFycmF5QnVmZmVyLCBfZW5jb2Rpbmc/OiBzdHJpbmcpOiB0aGlzIHtcbiAgICBsZXQgYnl0ZXM7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBkYXRhID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGRhdGEpO1xuICAgICAgYnl0ZXMgPSBjb2VyY2VUb0J5dGVzKGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBieXRlcyA9IGNvZXJjZVRvQnl0ZXMoZGF0YSk7XG4gICAgfVxuXG4gICAgdGhpcy4jY29udGV4dC51cGRhdGUoYnl0ZXMpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ2FsY3VsYXRlcyB0aGUgZGlnZXN0IG9mIGFsbCBvZiB0aGUgZGF0YS5cbiAgICpcbiAgICogSWYgZW5jb2RpbmcgaXMgcHJvdmlkZWQgYSBzdHJpbmcgd2lsbCBiZSByZXR1cm5lZDsgb3RoZXJ3aXNlIGEgQnVmZmVyIGlzIHJldHVybmVkLlxuICAgKlxuICAgKiBTdXBwb3J0ZWQgZW5jb2RpbmcgaXMgY3VycmVudGx5ICdoZXgnLCAnYmluYXJ5JywgJ2Jhc2U2NCcuXG4gICAqL1xuICBkaWdlc3QoZW5jb2Rpbmc/OiBzdHJpbmcpOiBCdWZmZXIgfCBzdHJpbmcge1xuICAgIGNvbnN0IGRpZ2VzdCA9IHRoaXMuI2NvbnRleHQuZGlnZXN0KHVuZGVmaW5lZCk7XG4gICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbShkaWdlc3QpO1xuICAgIH1cblxuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgXCJoZXhcIjpcbiAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShlbmNvZGVUb0hleChuZXcgVWludDhBcnJheShkaWdlc3QpKSk7XG4gICAgICBjYXNlIFwiYmluYXJ5XCI6XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKC4uLmRpZ2VzdCk7XG4gICAgICBjYXNlIFwiYmFzZTY0XCI6XG4gICAgICAgIHJldHVybiBlbmNvZGVUb0Jhc2U2NChkaWdlc3QpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBUaGUgb3V0cHV0IGVuY29kaW5nIGZvciBoYXNoIGRpZ2VzdCBpcyBub3QgaW1wbGVtZW50ZWQ6ICR7ZW5jb2Rpbmd9YCxcbiAgICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTdXBwb3J0ZWQgZGlnZXN0IG5hbWVzIHRoYXQgT3BlblNTTC9Ob2RlIGFuZCBXZWJDcnlwdG8gaWRlbnRpZnkgZGlmZmVyZW50bHkuXG4gKi9cbmNvbnN0IG9wZW5zc2xUb1dlYkNyeXB0b0RpZ2VzdE5hbWVzOiBSZWNvcmQ8c3RyaW5nLCBEaWdlc3RBbGdvcml0aG0+ID0ge1xuICBCTEFLRTJCNTEyOiBcIkJMQUtFMkJcIixcbiAgQkxBS0UyUzI1NjogXCJCTEFLRTJTXCIsXG4gIFJJUEVNRDE2MDogXCJSSVBFTUQtMTYwXCIsXG4gIFJNRDE2MDogXCJSSVBFTUQtMTYwXCIsXG4gIFNIQTE6IFwiU0hBLTFcIixcbiAgU0hBMjI0OiBcIlNIQS0yMjRcIixcbiAgU0hBMjU2OiBcIlNIQS0yNTZcIixcbiAgU0hBMzg0OiBcIlNIQS0zODRcIixcbiAgU0hBNTEyOiBcIlNIQS01MTJcIixcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIEhhc2ggb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgaGFzaCBkaWdlc3RzXG4gKiB1c2luZyB0aGUgZ2l2ZW4gYGFsZ29yaXRobWAuIE9wdGlvbmFsIGBvcHRpb25zYCBhcmd1bWVudCBjb250cm9scyBzdHJlYW0gYmVoYXZpb3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIYXNoKGFsZ29yaXRobTogc3RyaW5nLCBvcHRzPzogVHJhbnNmb3JtT3B0aW9ucykge1xuICByZXR1cm4gbmV3IEhhc2goYWxnb3JpdGhtLCBvcHRzKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIHRoZSBuYW1lcyBvZiB0aGUgc3VwcG9ydGVkIGhhc2ggYWxnb3JpdGhtcywgc3VjaCBhcyAnc2hhMScuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRIYXNoZXMoKTogcmVhZG9ubHkgc3RyaW5nW10ge1xuICByZXR1cm4gZGlnZXN0QWxnb3JpdGhtcztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUZBQXFGO0FBRXJGLFNBQ0UsTUFBTSxJQUFJLFVBQVUsRUFFcEIsZ0JBQWdCLFFBQ1gsMkJBQTJCLENBQUM7QUFDbkMsU0FBUyxNQUFNLFFBQVEsY0FBYyxDQUFDO0FBQ3RDLFNBQVMsU0FBUyxRQUFRLGNBQWMsQ0FBQztBQUN6QyxTQUFTLE1BQU0sSUFBSSxXQUFXLFFBQVEsdUJBQXVCLENBQUM7QUFDOUQsU0FBUyxNQUFNLElBQUksY0FBYyxRQUFRLDBCQUEwQixDQUFDO0FBR3BFLE1BQU0sYUFBYSxHQUFHLENBQUMsSUFBMkIsR0FBaUI7SUFDakUsSUFBSSxJQUFJLFlBQVksVUFBVSxFQUFFO1FBQzlCLE9BQU8sSUFBSSxDQUFDO0tBQ2IsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtRQUNuQyxnREFBZ0Q7UUFDaEQsT0FBTyxJQUFJLFdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN2QyxNQUFNLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNuQyxPQUFPLElBQUksVUFBVSxD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