// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
export * as crypto from "./crypto.js";
/**
 * All cryptographic hash/digest algorithms supported by std/_wasm_crypto.
 *
 * For algorithms that are supported by WebCrypto, the name here must match the
 * one used by WebCrypto. Otherwise we should prefer the formatting used in the
 * official specification. All names are uppercase to facilitate case-insensitive
 * comparisons required by the WebCrypto spec.
 */ export const digestAlgorithms = [
    "BLAKE2B-256",
    "BLAKE2B-384",
    "BLAKE2B",
    "BLAKE2S",
    "BLAKE3",
    "KECCAK-224",
    "KECCAK-256",
    "KECCAK-384",
    "KECCAK-512",
    "SHA-384",
    "SHA3-224",
    "SHA3-256",
    "SHA3-384",
    "SHA3-512",
    "SHAKE128",
    "SHAKE256",
    "TIGER",
    // insecure (length-extendable):
    "RIPEMD-160",
    "SHA-224",
    "SHA-256",
    "SHA-512",
    // insecure (collidable and length-extendable):
    "MD4",
    "MD5",
    "SHA-1", 
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyNS4wL193YXNtX2NyeXB0by9tb2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmV4cG9ydCAqIGFzIGNyeXB0byBmcm9tIFwiLi9jcnlwdG8uanNcIjtcblxuLyoqXG4gKiBBbGwgY3J5cHRvZ3JhcGhpYyBoYXNoL2RpZ2VzdCBhbGdvcml0aG1zIHN1cHBvcnRlZCBieSBzdGQvX3dhc21fY3J5cHRvLlxuICpcbiAqIEZvciBhbGdvcml0aG1zIHRoYXQgYXJlIHN1cHBvcnRlZCBieSBXZWJDcnlwdG8sIHRoZSBuYW1lIGhlcmUgbXVzdCBtYXRjaCB0aGVcbiAqIG9uZSB1c2VkIGJ5IFdlYkNyeXB0by4gT3RoZXJ3aXNlIHdlIHNob3VsZCBwcmVmZXIgdGhlIGZvcm1hdHRpbmcgdXNlZCBpbiB0aGVcbiAqIG9mZmljaWFsIHNwZWNpZmljYXRpb24uIEFsbCBuYW1lcyBhcmUgdXBwZXJjYXNlIHRvIGZhY2lsaXRhdGUgY2FzZS1pbnNlbnNpdGl2ZVxuICogY29tcGFyaXNvbnMgcmVxdWlyZWQgYnkgdGhlIFdlYkNyeXB0byBzcGVjLlxuICovXG5leHBvcnQgY29uc3QgZGlnZXN0QWxnb3JpdGhtcyA9IFtcbiAgXCJCTEFLRTJCLTI1NlwiLFxuICBcIkJMQUtFMkItMzg0XCIsXG4gIFwiQkxBS0UyQlwiLFxuICBcIkJMQUtFMlNcIixcbiAgXCJCTEFLRTNcIixcbiAgXCJLRUNDQUstMjI0XCIsXG4gIFwiS0VDQ0FLLTI1NlwiLFxuICBcIktFQ0NBSy0zODRcIixcbiAgXCJLRUNDQUstNTEyXCIsXG4gIFwiU0hBLTM4NFwiLFxuICBcIlNIQTMtMjI0XCIsXG4gIFwiU0hBMy0yNTZcIixcbiAgXCJTSEEzLTM4NFwiLFxuICBcIlNIQTMtNTEyXCIsXG4gIFwiU0hBS0UxMjhcIixcbiAgXCJTSEFLRTI1NlwiLFxuICBcIlRJR0VSXCIsXG4gIC8vIGluc2VjdXJlIChsZW5ndGgtZXh0ZW5kYWJsZSk6XG4gIFwiUklQRU1ELTE2MFwiLFxuICBcIlNIQS0yMjRcIixcbiAgXCJTSEEtMjU2XCIsXG4gIFwiU0hBLTUxMlwiLFxuICAvLyBpbnNlY3VyZSAoY29sbGlkYWJsZSBhbmQgbGVuZ3RoLWV4dGVuZGFibGUpOlxuICBcIk1ENFwiLFxuICBcIk1ENVwiLFxuICBcIlNIQS0xXCIsXG5dIGFzIGNvbnN0O1xuXG4vKiogQW4gYWxnb3JpdGhtIG5hbWUgc3VwcG9ydGVkIGJ5IHN0ZC9fd2FzbV9jcnlwdG8uICovXG5leHBvcnQgdHlwZSBEaWdlc3RBbGdvcml0aG0gPSB0eXBlb2YgZGlnZXN0QWxnb3JpdGhtc1tudW1iZXJdO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxPQUFPLEtBQUssTUFBTSxNQUFNLGFBQWEsQ0FBQztBQUV0Qzs7Ozs7OztHQU9HLENBQ0gsT0FBTyxNQUFNLGdCQUFnQixHQUFHO0lBQzlCLGFBQWE7SUFDYixhQUFhO0lBQ2IsU0FBUztJQUNULFNBQVM7SUFDVCxRQUFRO0lBQ1IsWUFBWTtJQUNaLFlBQVk7SUFDWixZQUFZO0lBQ1osWUFBWTtJQUNaLFNBQVM7SUFDVCxVQUFVO0lBQ1YsVUFBVTtJQUNWLFVBQVU7SUFDVixVQUFVO0lBQ1YsVUFBVTtJQUNWLFVBQVU7SUFDVixPQUFPO0lBQ1AsZ0NBQWdDO0lBQ2hDLFlBQVk7SUFDWixTQUFTO0lBQ1QsU0FBUztJQUNULFNBQVM7SUFDVCwrQ0FBK0M7SUFDL0MsS0FBSztJQUNMLEtBQUs7SUFDTCxPQUFPO0NBQ1IsQUFBUyxDQUFDIn0=