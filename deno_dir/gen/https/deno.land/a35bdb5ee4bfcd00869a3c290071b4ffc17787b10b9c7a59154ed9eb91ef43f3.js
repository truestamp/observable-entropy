import { crypto as wasmCrypto, digestAlgorithms as wasmDigestAlgorithms, } from "../_wasm_crypto/mod.ts";
const webCrypto = ((crypto) => ({
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
        wrapKey: crypto.subtle?.wrapKey?.bind(crypto.subtle),
    },
}))(globalThis.crypto);
const bufferSourceBytes = (data) => {
    let bytes;
    if (data instanceof Uint8Array) {
        bytes = data;
    }
    else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
    }
    return bytes;
};
const stdCrypto = ((x) => x)({
    ...webCrypto,
    subtle: {
        ...webCrypto.subtle,
        async digest(algorithm, data) {
            const { name, length } = normalizeAlgorithm(algorithm);
            const bytes = bufferSourceBytes(data);
            if (webCryptoDigestAlgorithms.includes(name) &&
                bytes) {
                return webCrypto.subtle.digest(algorithm, bytes);
            }
            else if (wasmDigestAlgorithms.includes(name)) {
                if (bytes) {
                    return stdCrypto.subtle.digestSync(algorithm, bytes);
                }
                else if (data[Symbol.iterator]) {
                    return stdCrypto.subtle.digestSync(algorithm, data);
                }
                else if (data[Symbol.asyncIterator]) {
                    const context = new wasmCrypto.DigestContext(name);
                    for await (const chunk of data) {
                        const chunkBytes = bufferSourceBytes(chunk);
                        if (!chunkBytes) {
                            throw new TypeError("data contained chunk of the wrong type");
                        }
                        context.update(chunkBytes);
                    }
                    return context.digestAndDrop(length).buffer;
                }
                else {
                    throw new TypeError("data must be a BufferSource or [Async]Iterable<BufferSource>");
                }
            }
            else if (webCrypto.subtle?.digest) {
                return webCrypto.subtle.digest(algorithm, data);
            }
            else {
                throw new TypeError(`unsupported digest algorithm: ${algorithm}`);
            }
        },
        digestSync(algorithm, data) {
            algorithm = normalizeAlgorithm(algorithm);
            const bytes = bufferSourceBytes(data);
            if (bytes) {
                return wasmCrypto.digest(algorithm.name, bytes, algorithm.length)
                    .buffer;
            }
            else if (data[Symbol.iterator]) {
                const context = new wasmCrypto.DigestContext(algorithm.name);
                for (const chunk of data) {
                    const chunkBytes = bufferSourceBytes(chunk);
                    if (!chunkBytes) {
                        throw new TypeError("data contained chunk of the wrong type");
                    }
                    context.update(chunkBytes);
                }
                return context.digestAndDrop(algorithm.length).buffer;
            }
            else {
                throw new TypeError("data must be a BufferSource or Iterable<BufferSource>");
            }
        },
    },
});
const webCryptoDigestAlgorithms = [
    "SHA-384",
    "SHA-256",
    "SHA-512",
    "SHA-1",
];
const normalizeAlgorithm = (algorithm) => ((typeof algorithm === "string") ? { name: algorithm.toUpperCase() } : {
    ...algorithm,
    name: algorithm.name.toUpperCase(),
});
export { stdCrypto as crypto };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFDTCxNQUFNLElBQUksVUFBVSxFQUVwQixnQkFBZ0IsSUFBSSxvQkFBb0IsR0FDekMsTUFBTSx3QkFBd0IsQ0FBQztBQU1oQyxNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzlCLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckQsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMzQyxNQUFNLEVBQUU7UUFDTixPQUFPLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDcEQsVUFBVSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQzFELFNBQVMsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUN4RCxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDbEQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ3BELFNBQVMsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUN4RCxXQUFXLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDNUQsU0FBUyxFQUFFLE1B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QUFDO2lCQUM1QjtnQkFDRCxPQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQzthQUN2RDtpQkFBTTtnQkFDTCxNQUFNLElBQUksU0FBUyxDQUNqQix1REFBdUQsQ0FDeEQsQ0FBQzthQUNIO1FBQ0gsQ0FBQztLQUNGO0NBQ0YsQ0FBQyxDQUFDO0FBR0gsTUFBTSx5QkFBeUIsR0FBRztJQUNoQyxTQUFTO0lBQ1QsU0FBUztJQUNULFNBQVM7SUFFVCxPQUFPO0NBQ0MsQ0FBQztBQVdYLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxTQUEwQixFQUFFLEVBQUUsQ0FDeEQsQ0FBQyxDQUFDLE9BQU8sU0FBUyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckUsR0FBRyxTQUFTO0lBQ1osSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO0NBQ25DLENBQTBCLENBQUM7QUFFOUIsT0FBTyxFQUFFLFNBQVMsSUFBSSxNQUFNLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQge1xuICBjcnlwdG8gYXMgd2FzbUNyeXB0byxcbiAgRGlnZXN0QWxnb3JpdGhtIGFzIFdhc21EaWdlc3RBbGdvcml0aG0sXG4gIGRpZ2VzdEFsZ29yaXRobXMgYXMgd2FzbURpZ2VzdEFsZ29yaXRobXMsXG59IGZyb20gXCIuLi9fd2FzbV9jcnlwdG8vbW9kLnRzXCI7XG5cbi8qKlxuICogQSBjb3B5IG9mIHRoZSBnbG9iYWwgV2ViQ3J5cHRvIGludGVyZmFjZSwgd2l0aCBtZXRob2RzIGJvdW5kIHNvIHRoZXkncmVcbiAqIHNhZmUgdG8gcmUtZXhwb3J0LlxuICovXG5jb25zdCB3ZWJDcnlwdG8gPSAoKGNyeXB0bykgPT4gKHtcbiAgZ2V0UmFuZG9tVmFsdWVzOiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzPy5iaW5kKGNyeXB0byksXG4gIHJhbmRvbVVVSUQ6IGNyeXB0by5yYW5kb21VVUlEPy5iaW5kKGNyeXB0byksXG4gIHN1YnRsZToge1xuICAgIGRlY3J5cHQ6IGNyeXB0by5zdWJ0bGU/LmRlY3J5cHQ/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgZGVyaXZlQml0czogY3J5cHRvLnN1YnRsZT8uZGVyaXZlQml0cz8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBkZXJpdmVLZXk6IGNyeXB0by5zdWJ0bGU/LmRlcml2ZUtleT8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBkaWdlc3Q6IGNyeXB0by5zdWJ0bGU/LmRpZ2VzdD8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBlbmNyeXB0OiBjcnlwdG8uc3VidGxlPy5lbmNyeXB0Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGV4cG9ydEtleTogY3J5cHRvLnN1YnRsZT8uZXhwb3J0S2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGdlbmVyYXRlS2V5OiBjcnlwdG8uc3VidGxlPy5nZW5lcmF0ZUtleT8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBpbXBvcnRLZXk6IGNyeXB0by5zdWJ0bGU/LmltcG9ydEtleT8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBzaWduOiBjcnlwdG8uc3VidGxlPy5zaWduPy5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIHVud3JhcEtleTogY3J5cHRvLnN1YnRsZT8udW53cmFwS2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIHZlcmlmeTogY3J5cHRvLnN1YnRsZT8udmVyaWZ5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIHdyYXBLZXk6IGNyeXB0by5zdWJ0bGU/LndyYXBLZXk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gIH0sXG59KSkoZ2xvYmFsVGhpcy5jcnlwdG8pO1xuXG5jb25zdCBidWZmZXJTb3VyY2VCeXRlcyA9IChkYXRhOiBCdWZmZXJTb3VyY2UgfCB1bmtub3duKSA9PiB7XG4gIGxldCBieXRlczogVWludDhBcnJheSB8IHVuZGVmaW5lZDtcbiAgaWYgKGRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgYnl0ZXMgPSBkYXRhO1xuICB9IGVsc2UgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhkYXRhKSkge1xuICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICBkYXRhLmJ1ZmZlcixcbiAgICAgIGRhdGEuYnl0ZU9mZnNldCxcbiAgICAgIGRhdGEuYnl0ZUxlbmd0aCxcbiAgICApO1xuICB9IGVsc2UgaWYgKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gIH1cbiAgcmV0dXJuIGJ5dGVzO1xufTtcblxuLyoqXG4gKiBBbiB3cmFwcGVyIGZvciBXZWJDcnlwdG8gYWRkaW5nIHN1cHBvcnQgZm9yIGFkZGl0aW9uYWwgbm9uLXN0YW5kYXJkXG4gKiBhbGdvcml0aG1zLCBidXQgZGVsZWdhdGluZyB0byB0aGUgcnVudGltZSBXZWJDcnlwdG8gaW1wbGVtZW50YXRpb24gd2hlbmV2ZXJcbiAqIHBvc3NpYmxlLlxuICovXG5jb25zdCBzdGRDcnlwdG8gPSAoKHgpID0+IHgpKHtcbiAgLi4ud2ViQ3J5cHRvLFxuICBzdWJ0bGU6IHtcbiAgICAuLi53ZWJDcnlwdG8uc3VidGxlLFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG5ldyBgUHJvbWlzZWAgb2JqZWN0IHRoYXQgd2lsbCBkaWdlc3QgYGRhdGFgIHVzaW5nIHRoZSBzcGVjaWZpZWRcbiAgICAgKiBgQWxnb3JpdGhtSWRlbnRpZmllcmAuXG4gICAgICovXG4gICAgYXN5bmMgZGlnZXN0KFxuICAgICAgYWxnb3JpdGhtOiBEaWdlc3RBbGdvcml0aG0sXG4gICAgICBkYXRhOiBCdWZmZXJTb3VyY2UgfCBBc3luY0l0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4gfCBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+LFxuICAgICk6IFByb21pc2U8QXJyYXlCdWZmZXI+IHtcbiAgICAgIGNvbnN0IHsgbmFtZSwgbGVuZ3RoIH0gPSBub3JtYWxpemVBbGdvcml0aG0oYWxnb3JpdGhtKTtcbiAgICAgIGNvbnN0IGJ5dGVzID0gYnVmZmVyU291cmNlQnl0ZXMoZGF0YSk7XG5cbiAgICAgIC8vIFdlIGRlbGVnYXRlIHRvIFdlYkNyeXB0byB3aGVuZXZlciBwb3NzaWJsZSxcbiAgICAgIGlmIChcbiAgICAgICAgLy8gaWYgdGhlIGFsZ29yaXRobSBpcyBzdXBwb3J0ZWQgYnkgdGhlIFdlYkNyeXB0byBzdGFuZGFyZCxcbiAgICAgICAgKHdlYkNyeXB0b0RpZ2VzdEFsZ29yaXRobXMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKG5hbWUpICYmXG4gICAgICAgIC8vIGFuZCB0aGUgZGF0YSBpcyBhIHNpbmdsZSBidWZmZXIsXG4gICAgICAgIGJ5dGVzXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHdlYkNyeXB0by5zdWJ0bGUuZGlnZXN0KGFsZ29yaXRobSwgYnl0ZXMpO1xuICAgICAgfSBlbHNlIGlmICh3YXNtRGlnZXN0QWxnb3JpdGhtcy5pbmNsdWRlcyhuYW1lKSkge1xuICAgICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2UsIHdlIHVzZSBvdXIgYnVuZGxlZCBXQVNNIGltcGxlbWVudGF0aW9uIHZpYSBkaWdlc3RTeW5jXG4gICAgICAgICAgLy8gaWYgaXQgc3VwcG9ydHMgdGhlIGFsZ29yaXRobS5cbiAgICAgICAgICByZXR1cm4gc3RkQ3J5cHRvLnN1YnRsZS5kaWdlc3RTeW5jKGFsZ29yaXRobSwgYnl0ZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKChkYXRhIGFzIEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4pW1N5bWJvbC5pdGVyYXRvcl0pIHtcbiAgICAgICAgICByZXR1cm4gc3RkQ3J5cHRvLnN1YnRsZS5kaWdlc3RTeW5jKFxuICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgZGF0YSBhcyBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+LFxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgKGRhdGEgYXMgQXN5bmNJdGVyYWJsZTxCdWZmZXJTb3VyY2U+KVtTeW1ib2wuYXN5bmNJdGVyYXRvcl1cbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgY29udGV4dCA9IG5ldyB3YXNtQ3J5cHRvLkRpZ2VzdENvbnRleHQobmFtZSk7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBkYXRhIGFzIEFzeW5jSXRlcmFibGU8QnVmZmVyU291cmNlPikge1xuICAgICAgICAgICAgY29uc3QgY2h1bmtCeXRlcyA9IGJ1ZmZlclNvdXJjZUJ5dGVzKGNodW5rKTtcbiAgICAgICAgICAgIGlmICghY2h1bmtCeXRlcykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZGF0YSBjb250YWluZWQgY2h1bmsgb2YgdGhlIHdyb25nIHR5cGVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250ZXh0LnVwZGF0ZShjaHVua0J5dGVzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGNvbnRleHQuZGlnZXN0QW5kRHJvcChsZW5ndGgpLmJ1ZmZlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJkYXRhIG11c3QgYmUgYSBCdWZmZXJTb3VyY2Ugb3IgW0FzeW5jXUl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT5cIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHdlYkNyeXB0by5zdWJ0bGU/LmRpZ2VzdCkge1xuICAgICAgICAvLyAoVHlwZVNjcmlwdCB0eXBlIGRlZmluaXRpb25zIHByb2hpYml0IHRoaXMgY2FzZS4pIElmIHRoZXkncmUgdHJ5aW5nXG4gICAgICAgIC8vIHRvIGNhbGwgYW4gYWxnb3JpdGhtIHdlIGRvbid0IHJlY29nbml6ZSwgcGFzcyBpdCBhbG9uZyB0byBXZWJDcnlwdG9cbiAgICAgICAgLy8gaW4gY2FzZSBpdCdzIGEgbm9uLXN0YW5kYXJkIGFsZ29yaXRobSBzdXBwb3J0ZWQgYnkgdGhlIHRoZSBydW50aW1lXG4gICAgICAgIC8vIHRoZXkncmUgdXNpbmcuXG4gICAgICAgIHJldHVybiB3ZWJDcnlwdG8uc3VidGxlLmRpZ2VzdChcbiAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgKGRhdGEgYXMgdW5rbm93bikgYXMgVWludDhBcnJheSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYHVuc3VwcG9ydGVkIGRpZ2VzdCBhbGdvcml0aG06ICR7YWxnb3JpdGhtfWApO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgQXJyYXlCdWZmZXIgd2l0aCB0aGUgcmVzdWx0IG9mIGRpZ2VzdGluZyBgZGF0YWAgdXNpbmcgdGhlXG4gICAgICogc3BlY2lmaWVkIGBBbGdvcml0aG1JZGVudGlmaWVyYC5cbiAgICAgKi9cbiAgICBkaWdlc3RTeW5jKFxuICAgICAgYWxnb3JpdGhtOiBEaWdlc3RBbGdvcml0aG0sXG4gICAgICBkYXRhOiBCdWZmZXJTb3VyY2UgfCBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+LFxuICAgICk6IEFycmF5QnVmZmVyIHtcbiAgICAgIGFsZ29yaXRobSA9IG5vcm1hbGl6ZUFsZ29yaXRobShhbGdvcml0aG0pO1xuXG4gICAgICBjb25zdCBieXRlcyA9IGJ1ZmZlclNvdXJjZUJ5dGVzKGRhdGEpO1xuXG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgcmV0dXJuIHdhc21DcnlwdG8uZGlnZXN0KGFsZ29yaXRobS5uYW1lLCBieXRlcywgYWxnb3JpdGhtLmxlbmd0aClcbiAgICAgICAgICAuYnVmZmVyO1xuICAgICAgfSBlbHNlIGlmICgoZGF0YSBhcyBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+KVtTeW1ib2wuaXRlcmF0b3JdKSB7XG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgd2FzbUNyeXB0by5EaWdlc3RDb250ZXh0KGFsZ29yaXRobS5uYW1lKTtcbiAgICAgICAgZm9yIChjb25zdCBjaHVuayBvZiBkYXRhIGFzIEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4pIHtcbiAgICAgICAgICBjb25zdCBjaHVua0J5dGVzID0gYnVmZmVyU291cmNlQnl0ZXMoY2h1bmspO1xuICAgICAgICAgIGlmICghY2h1bmtCeXRlcykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImRhdGEgY29udGFpbmVkIGNodW5rIG9mIHRoZSB3cm9uZyB0eXBlXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250ZXh0LnVwZGF0ZShjaHVua0J5dGVzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dC5kaWdlc3RBbmREcm9wKGFsZ29yaXRobS5sZW5ndGgpLmJ1ZmZlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgXCJkYXRhIG11c3QgYmUgYSBCdWZmZXJTb3VyY2Ugb3IgSXRlcmFibGU8QnVmZmVyU291cmNlPlwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0sXG4gIH0sXG59KTtcblxuLyoqIERpZ2VzdCBhbGdvcml0aG1zIHN1cHBvcnRlZCBieSBXZWJDcnlwdG8uICovXG5jb25zdCB3ZWJDcnlwdG9EaWdlc3RBbGdvcml0aG1zID0gW1xuICBcIlNIQS0zODRcIixcbiAgXCJTSEEtMjU2XCIsXG4gIFwiU0hBLTUxMlwiLFxuICAvLyBpbnNlY3VyZSAobGVuZ3RoLWV4dGVuZGFibGUgYW5kIGNvbGxpZGFibGUpOlxuICBcIlNIQS0xXCIsXG5dIGFzIGNvbnN0O1xuXG50eXBlIERpZ2VzdEFsZ29yaXRobU5hbWUgPSBXYXNtRGlnZXN0QWxnb3JpdGhtO1xuXG50eXBlIERpZ2VzdEFsZ29yaXRobU9iamVjdCA9IHtcbiAgbmFtZTogRGlnZXN0QWxnb3JpdGhtTmFtZTtcbiAgbGVuZ3RoPzogbnVtYmVyO1xufTtcblxudHlwZSBEaWdlc3RBbGdvcml0aG0gPSBEaWdlc3RBbGdvcml0aG1OYW1lIHwgRGlnZXN0QWxnb3JpdGhtT2JqZWN0O1xuXG5jb25zdCBub3JtYWxpemVBbGdvcml0aG0gPSAoYWxnb3JpdGhtOiBEaWdlc3RBbGdvcml0aG0pID0+XG4gICgodHlwZW9mIGFsZ29yaXRobSA9PT0gXCJzdHJpbmdcIikgPyB7IG5hbWU6IGFsZ29yaXRobS50b1VwcGVyQ2FzZSgpIH0gOiB7XG4gICAgLi4uYWxnb3JpdGhtLFxuICAgIG5hbWU6IGFsZ29yaXRobS5uYW1lLnRvVXBwZXJDYXNlKCksXG4gIH0pIGFzIERpZ2VzdEFsZ29yaXRobU9iamVjdDtcblxuZXhwb3J0IHsgc3RkQ3J5cHRvIGFzIGNyeXB0byB9O1xuIl19