// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { crypto as wasmCrypto, digestAlgorithms as wasmDigestAlgorithms } from "../_wasm_crypto/mod.ts";
/**
 * A copy of the global WebCrypto interface, with methods bound so they're
 * safe to re-export.
 */ const webCrypto = ((crypto)=>({
        getRandomValues: crypto.getRandomValues?.bind(crypto),
        randomUUID: crypto.randomUUID?.bind(crypto),
        subtle: {
            decrypt: crypto.subtle?.decrypt?.bind(crypto.subtle),
            deriveBits: crypto.subtle?.deriveBits?.bind(crypto.subtle),
            deriveKey: crypto.subtle?.deriveKey?.bind(crypto.subtle),
            digest: crypto.subtle?.digest?.bind(crypto.subtle),
            encrypt: crypto.subtle?.encrypt?.bind(crypto.subtle),
            exportKey: crypto.subtle?.exportKey?.bind(crypto.subtle),
            generateKey: crypto.subtle?.generateKey?.bind(crypto.subtle),
            importKey: crypto.subtle?.importKey?.bind(crypto.subtle),
            sign: crypto.subtle?.sign?.bind(crypto.subtle),
            unwrapKey: crypto.subtle?.unwrapKey?.bind(crypto.subtle),
            verify: crypto.subtle?.verify?.bind(crypto.subtle),
            wrapKey: crypto.subtle?.wrapKey?.bind(crypto.subtle)
        }
    }))(globalThis.crypto);
const bufferSourceBytes = (data)=>{
    let bytes;
    if (data instanceof Uint8Array) {
        bytes = data;
    } else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
    }
    return bytes;
};
/**
 * An wrapper for WebCrypto adding support for additional non-standard
 * algorithms, but delegating to the runtime WebCrypto implementation whenever
 * possible.
 */ const stdCrypto = ((x)=>x)({
    ...webCrypto,
    subtle: {
        ...webCrypto.subtle,
        /**
     * Returns a new `Promise` object that will digest `data` using the specified
     * `AlgorithmIdentifier`.
     */ async digest (algorithm, data) {
            const { name , length  } = normalizeAlgorithm(algorithm);
            const bytes = bufferSourceBytes(data);
            // We delegate to WebCrypto whenever possible,
            if (// if the algorithm is supported by the WebCrypto standard,
            (webCryptoDigestAlgorithms).includes(name) && // and the data is a single buffer,
            bytes) {
                return webCrypto.subtle.digest(algorithm, bytes);
            } else if (wasmDigestAlgorithms.includes(name)) {
                if (bytes) {
                    // Otherwise, we use our bundled WASM implementation via digestSync
                    // if it supports the algorithm.
                    return stdCrypto.subtle.digestSync(algorithm, bytes);
                } else if (data[Symbol.iterator]) {
                    return stdCrypto.subtle.digestSync(algorithm, data);
                } else if (data[Symbol.asyncIterator]) {
                    const context = new wasmCrypto.DigestContext(name);
                    for await (const chunk of data){
                        const chunkBytes = bufferSourceBytes(chunk);
                        if (!chunkBytes) {
                            throw new TypeError("data contained chunk of the wrong type");
                        }
                        context.update(chunkBytes);
                    }
                    return context.digestAndDrop(length).buffer;
                } else {
                    throw new TypeError("data must be a BufferSource or [Async]Iterable<BufferSource>");
                }
            } else if (webCrypto.subtle?.digest) {
                // (TypeScript type definitions prohibit this case.) If they're trying
                // to call an algorithm we don't recognize, pass it along to WebCrypto
                // in case it's a non-standard algorithm supported by the the runtime
                // they're using.
                return webCrypto.subtle.digest(algorithm, data);
            } else {
                throw new TypeError(`unsupported digest algorithm: ${algorithm}`);
            }
        },
        /**
     * Returns a ArrayBuffer with the result of digesting `data` using the
     * specified `AlgorithmIdentifier`.
     */ digestSync (algorithm, data) {
            algorithm = normalizeAlgorithm(algorithm);
            const bytes = bufferSourceBytes(data);
            if (bytes) {
                return wasmCrypto.digest(algorithm.name, bytes, algorithm.length).buffer;
            } else if (data[Symbol.iterator]) {
                const context = new wasmCrypto.DigestContext(algorithm.name);
                for (const chunk of data){
                    const chunkBytes = bufferSourceBytes(chunk);
                    if (!chunkBytes) {
                        throw new TypeError("data contained chunk of the wrong type");
                    }
                    context.update(chunkBytes);
                }
                return context.digestAndDrop(algorithm.length).buffer;
            } else {
                throw new TypeError("data must be a BufferSource or Iterable<BufferSource>");
            }
        }
    }
});
/** Digest algorithms supported by WebCrypto. */ const webCryptoDigestAlgorithms = [
    "SHA-384",
    "SHA-256",
    "SHA-512",
    // insecure (length-extendable and collidable):
    "SHA-1", 
];
const normalizeAlgorithm = (algorithm)=>typeof algorithm === "string" ? {
        name: algorithm.toUpperCase()
    } : {
        ...algorithm,
        name: algorithm.name.toUpperCase()
    };
export { stdCrypto as crypto };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyNS4wL2NyeXB0by9tb2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7XG4gIGNyeXB0byBhcyB3YXNtQ3J5cHRvLFxuICBEaWdlc3RBbGdvcml0aG0gYXMgV2FzbURpZ2VzdEFsZ29yaXRobSxcbiAgZGlnZXN0QWxnb3JpdGhtcyBhcyB3YXNtRGlnZXN0QWxnb3JpdGhtcyxcbn0gZnJvbSBcIi4uL193YXNtX2NyeXB0by9tb2QudHNcIjtcblxuLyoqXG4gKiBBIGNvcHkgb2YgdGhlIGdsb2JhbCBXZWJDcnlwdG8gaW50ZXJmYWNlLCB3aXRoIG1ldGhvZHMgYm91bmQgc28gdGhleSdyZVxuICogc2FmZSB0byByZS1leHBvcnQuXG4gKi9cbmNvbnN0IHdlYkNyeXB0byA9ICgoY3J5cHRvKSA9PiAoe1xuICBnZXRSYW5kb21WYWx1ZXM6IGNyeXB0by5nZXRSYW5kb21WYWx1ZXM/LmJpbmQoY3J5cHRvKSxcbiAgcmFuZG9tVVVJRDogY3J5cHRvLnJhbmRvbVVVSUQ/LmJpbmQoY3J5cHRvKSxcbiAgc3VidGxlOiB7XG4gICAgZGVjcnlwdDogY3J5cHRvLnN1YnRsZT8uZGVjcnlwdD8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBkZXJpdmVCaXRzOiBjcnlwdG8uc3VidGxlPy5kZXJpdmVCaXRzPy5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGRlcml2ZUtleTogY3J5cHRvLnN1YnRsZT8uZGVyaXZlS2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGRpZ2VzdDogY3J5cHRvLnN1YnRsZT8uZGlnZXN0Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGVuY3J5cHQ6IGNyeXB0by5zdWJ0bGU/LmVuY3J5cHQ/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgZXhwb3J0S2V5OiBjcnlwdG8uc3VidGxlPy5leHBvcnRLZXk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgZ2VuZXJhdGVLZXk6IGNyeXB0by5zdWJ0bGU/LmdlbmVyYXRlS2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGltcG9ydEtleTogY3J5cHRvLnN1YnRsZT8uaW1wb3J0S2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIHNpZ246IGNyeXB0by5zdWJ0bGU/LnNpZ24/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgdW53cmFwS2V5OiBjcnlwdG8uc3VidGxlPy51bndyYXBLZXk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgdmVyaWZ5OiBjcnlwdG8uc3VidGxlPy52ZXJpZnk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgd3JhcEtleTogY3J5cHRvLnN1YnRsZT8ud3JhcEtleT8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgfSxcbn0pKShnbG9iYWxUaGlzLmNyeXB0byk7XG5cbmNvbnN0IGJ1ZmZlclNvdXJjZUJ5dGVzID0gKGRhdGE6IEJ1ZmZlclNvdXJjZSB8IHVua25vd24pID0+IHtcbiAgbGV0IGJ5dGVzOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkO1xuICBpZiAoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICBieXRlcyA9IGRhdGE7XG4gIH0gZWxzZSBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGRhdGEpKSB7XG4gICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShcbiAgICAgIGRhdGEuYnVmZmVyLFxuICAgICAgZGF0YS5ieXRlT2Zmc2V0LFxuICAgICAgZGF0YS5ieXRlTGVuZ3RoLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoZGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgfVxuICByZXR1cm4gYnl0ZXM7XG59O1xuXG4vKipcbiAqIEFuIHdyYXBwZXIgZm9yIFdlYkNyeXB0byBhZGRpbmcgc3VwcG9ydCBmb3IgYWRkaXRpb25hbCBub24tc3RhbmRhcmRcbiAqIGFsZ29yaXRobXMsIGJ1dCBkZWxlZ2F0aW5nIHRvIHRoZSBydW50aW1lIFdlYkNyeXB0byBpbXBsZW1lbnRhdGlvbiB3aGVuZXZlclxuICogcG9zc2libGUuXG4gKi9cbmNvbnN0IHN0ZENyeXB0byA9ICgoeCkgPT4geCkoe1xuICAuLi53ZWJDcnlwdG8sXG4gIHN1YnRsZToge1xuICAgIC4uLndlYkNyeXB0by5zdWJ0bGUsXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgbmV3IGBQcm9taXNlYCBvYmplY3QgdGhhdCB3aWxsIGRpZ2VzdCBgZGF0YWAgdXNpbmcgdGhlIHNwZWNpZmllZFxuICAgICAqIGBBbGdvcml0aG1JZGVudGlmaWVyYC5cbiAgICAgKi9cbiAgICBhc3luYyBkaWdlc3QoXG4gICAgICBhbGdvcml0aG06IERpZ2VzdEFsZ29yaXRobSxcbiAgICAgIGRhdGE6IEJ1ZmZlclNvdXJjZSB8IEFzeW5jSXRlcmFibGU8QnVmZmVyU291cmNlPiB8IEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4sXG4gICAgKTogUHJvbWlzZTxBcnJheUJ1ZmZlcj4ge1xuICAgICAgY29uc3QgeyBuYW1lLCBsZW5ndGggfSA9IG5vcm1hbGl6ZUFsZ29yaXRobShhbGdvcml0aG0pO1xuICAgICAgY29uc3QgYnl0ZXMgPSBidWZmZXJTb3VyY2VCeXRlcyhkYXRhKTtcblxuICAgICAgLy8gV2UgZGVsZWdhdGUgdG8gV2ViQ3J5cHRvIHdoZW5ldmVyIHBvc3NpYmxlLFxuICAgICAgaWYgKFxuICAgICAgICAvLyBpZiB0aGUgYWxnb3JpdGhtIGlzIHN1cHBvcnRlZCBieSB0aGUgV2ViQ3J5cHRvIHN0YW5kYXJkLFxuICAgICAgICAod2ViQ3J5cHRvRGlnZXN0QWxnb3JpdGhtcyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMobmFtZSkgJiZcbiAgICAgICAgLy8gYW5kIHRoZSBkYXRhIGlzIGEgc2luZ2xlIGJ1ZmZlcixcbiAgICAgICAgYnl0ZXNcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gd2ViQ3J5cHRvLnN1YnRsZS5kaWdlc3QoYWxnb3JpdGhtLCBieXRlcyk7XG4gICAgICB9IGVsc2UgaWYgKHdhc21EaWdlc3RBbGdvcml0aG1zLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgICAgIGlmIChieXRlcykge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSwgd2UgdXNlIG91ciBidW5kbGVkIFdBU00gaW1wbGVtZW50YXRpb24gdmlhIGRpZ2VzdFN5bmNcbiAgICAgICAgICAvLyBpZiBpdCBzdXBwb3J0cyB0aGUgYWxnb3JpdGhtLlxuICAgICAgICAgIHJldHVybiBzdGRDcnlwdG8uc3VidGxlLmRpZ2VzdFN5bmMoYWxnb3JpdGhtLCBieXRlcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoKGRhdGEgYXMgSXRlcmFibGU8QnVmZmVyU291cmNlPilbU3ltYm9sLml0ZXJhdG9yXSkge1xuICAgICAgICAgIHJldHVybiBzdGRDcnlwdG8uc3VidGxlLmRpZ2VzdFN5bmMoXG4gICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICBkYXRhIGFzIEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4sXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAoZGF0YSBhcyBBc3luY0l0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4pW1N5bWJvbC5hc3luY0l0ZXJhdG9yXVxuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBjb250ZXh0ID0gbmV3IHdhc21DcnlwdG8uRGlnZXN0Q29udGV4dChuYW1lKTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIGRhdGEgYXMgQXN5bmNJdGVyYWJsZTxCdWZmZXJTb3VyY2U+KSB7XG4gICAgICAgICAgICBjb25zdCBjaHVua0J5dGVzID0gYnVmZmVyU291cmNlQnl0ZXMoY2h1bmspO1xuICAgICAgICAgICAgaWYgKCFjaHVua0J5dGVzKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJkYXRhIGNvbnRhaW5lZCBjaHVuayBvZiB0aGUgd3JvbmcgdHlwZVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRleHQudXBkYXRlKGNodW5rQnl0ZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gY29udGV4dC5kaWdlc3RBbmREcm9wKGxlbmd0aCkuYnVmZmVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBcImRhdGEgbXVzdCBiZSBhIEJ1ZmZlclNvdXJjZSBvciBbQXN5bmNdSXRlcmFibGU8QnVmZmVyU291cmNlPlwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAod2ViQ3J5cHRvLnN1YnRsZT8uZGlnZXN0KSB7XG4gICAgICAgIC8vIChUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnMgcHJvaGliaXQgdGhpcyBjYXNlLikgSWYgdGhleSdyZSB0cnlpbmdcbiAgICAgICAgLy8gdG8gY2FsbCBhbiBhbGdvcml0aG0gd2UgZG9uJ3QgcmVjb2duaXplLCBwYXNzIGl0IGFsb25nIHRvIFdlYkNyeXB0b1xuICAgICAgICAvLyBpbiBjYXNlIGl0J3MgYSBub24tc3RhbmRhcmQgYWxnb3JpdGhtIHN1cHBvcnRlZCBieSB0aGUgdGhlIHJ1bnRpbWVcbiAgICAgICAgLy8gdGhleSdyZSB1c2luZy5cbiAgICAgICAgcmV0dXJuIHdlYkNyeXB0by5zdWJ0bGUuZGlnZXN0KFxuICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAoZGF0YSBhcyB1bmtub3duKSBhcyBVaW50OEFycmF5LFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgdW5zdXBwb3J0ZWQgZGlnZXN0IGFsZ29yaXRobTogJHthbGdvcml0aG19YCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBBcnJheUJ1ZmZlciB3aXRoIHRoZSByZXN1bHQgb2YgZGlnZXN0aW5nIGBkYXRhYCB1c2luZyB0aGVcbiAgICAgKiBzcGVjaWZpZWQgYEFsZ29yaXRobUlkZW50aWZpZXJgLlxuICAgICAqL1xuICAgIGRpZ2VzdFN5bmMoXG4gICAgICBhbGdvcml0aG06IERpZ2VzdEFsZ29yaXRobSxcbiAgICAgIGRhdGE6IEJ1ZmZlclNvdXJjZSB8IEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4sXG4gICAgKTogQXJyYXlCdWZmZXIge1xuICAgICAgYWxnb3JpdGhtID0gbm9ybWFsaXplQWxnb3JpdGhtKGFsZ29yaXRobSk7XG5cbiAgICAgIGNvbnN0IGJ5dGVzID0gYnVmZmVyU291cmNlQnl0ZXMoZGF0YSk7XG5cbiAgICAgIGlmIChieXRlcykge1xuICAgICAgICByZXR1cm4gd2FzbUNyeXB0by5kaWdlc3QoYWxnb3JpdGhtLm5hbWUsIGJ5dGVzLCBhbGdvcml0aG0ubGVuZ3RoKVxuICAgICAgICAgIC5idWZmZXI7XG4gICAgICB9IGVsc2UgaWYgKChkYXRhIGFzIEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4pW1N5bWJvbC5pdGVyYXRvcl0pIHtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IG5ldyB3YXNtQ3J5cHRvLkRpZ2VzdENvbnRleHQoYWxnb3JpdGhtLm5hbWUpO1xuICAgICAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGRhdGEgYXMgSXRlcmFibGU8QnVmZmVyU291cmNlPikge1xuICAgICAgICAgIGNvbnN0IGNodW5rQnl0ZXMgPSBidWZmZXJTb3VyY2VCeXRlcyhjaHVuayk7XG4gICAgICAgICAgaWYgKCFjaHVua0J5dGVzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZGF0YSBjb250YWluZWQgY2h1bmsgb2YgdGhlIHdyb25nIHR5cGVcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRleHQudXBkYXRlKGNodW5rQnl0ZXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXh0LmRpZ2VzdEFuZERyb3AoYWxnb3JpdGhtLmxlbmd0aCkuYnVmZmVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcImRhdGEgbXVzdCBiZSBhIEJ1ZmZlclNvdXJjZSBvciBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+XCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSxcbiAgfSxcbn0pO1xuXG4vKiogRGlnZXN0IGFsZ29yaXRobXMgc3VwcG9ydGVkIGJ5IFdlYkNyeXB0by4gKi9cbmNvbnN0IHdlYkNyeXB0b0RpZ2VzdEFsZ29yaXRobXMgPSBbXG4gIFwiU0hBLTM4NFwiLFxuICBcIlNIQS0yNTZcIixcbiAgXCJTSEEtNTEyXCIsXG4gIC8vIGluc2VjdXJlIChsZW5ndGgtZXh0ZW5kYWJsZSBhbmQgY29sbGlkYWJsZSk6XG4gIFwiU0hBLTFcIixcbl0gYXMgY29uc3Q7XG5cbnR5cGUgRGlnZXN0QWxnb3JpdGhtTmFtZSA9IFdhc21EaWdlc3RBbGdvcml0aG07XG5cbnR5cGUgRGlnZXN0QWxnb3JpdGhtT2JqZWN0ID0ge1xuICBuYW1lOiBEaWdlc3RBbGdvcml0aG1OYW1lO1xuICBsZW5ndGg/OiBudW1iZXI7XG59O1xuXG50eXBlIERpZ2VzdEFsZ29yaXRobSA9IERpZ2VzdEFsZ29yaXRobU5hbWUgfCBEaWdlc3RBbGdvcml0aG1PYmplY3Q7XG5cbmNvbnN0IG5vcm1hbGl6ZUFsZ29yaXRobSA9IChhbGdvcml0aG06IERpZ2VzdEFsZ29yaXRobSkgPT5cbiAgKCh0eXBlb2YgYWxnb3JpdGhtID09PSBcInN0cmluZ1wiKSA/IHsgbmFtZTogYWxnb3JpdGhtLnRvVXBwZXJDYXNlKCkgfSA6IHtcbiAgICAuLi5hbGdvcml0aG0sXG4gICAgbmFtZTogYWxnb3JpdGhtLm5hbWUudG9VcHBlckNhc2UoKSxcbiAgfSkgYXMgRGlnZXN0QWxnb3JpdGhtT2JqZWN0O1xuXG5leHBvcnQgeyBzdGRDcnlwdG8gYXMgY3J5cHRv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