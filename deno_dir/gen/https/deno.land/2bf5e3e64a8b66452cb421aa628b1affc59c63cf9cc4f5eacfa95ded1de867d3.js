// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { Hash } from "./_wasm/hash.ts";
export const supportedAlgorithms = [
    "md2",
    "md4",
    "md5",
    "ripemd160",
    "ripemd320",
    "sha1",
    "sha224",
    "sha256",
    "sha384",
    "sha512",
    "sha3-224",
    "sha3-256",
    "sha3-384",
    "sha3-512",
    "keccak224",
    "keccak256",
    "keccak384",
    "keccak512", 
];
/**
 * Creates a new `Hash` instance.
 *
 * @param algorithm name of hash algorithm to use
 */ export function createHash(algorithm) {
    return new Hash(algorithm);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjk4LjAvaGFzaC9tb2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMSB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgSGFzaCB9IGZyb20gXCIuL193YXNtL2hhc2gudHNcIjtcbmltcG9ydCB0eXBlIHsgSGFzaGVyIH0gZnJvbSBcIi4vaGFzaGVyLnRzXCI7XG5cbmV4cG9ydCB0eXBlIHsgSGFzaGVyIH0gZnJvbSBcIi4vaGFzaGVyLnRzXCI7XG5leHBvcnQgY29uc3Qgc3VwcG9ydGVkQWxnb3JpdGhtcyA9IFtcbiAgXCJtZDJcIixcbiAgXCJtZDRcIixcbiAgXCJtZDVcIixcbiAgXCJyaXBlbWQxNjBcIixcbiAgXCJyaXBlbWQzMjBcIixcbiAgXCJzaGExXCIsXG4gIFwic2hhMjI0XCIsXG4gIFwic2hhMjU2XCIsXG4gIFwic2hhMzg0XCIsXG4gIFwic2hhNTEyXCIsXG4gIFwic2hhMy0yMjRcIixcbiAgXCJzaGEzLTI1NlwiLFxuICBcInNoYTMtMzg0XCIsXG4gIFwic2hhMy01MTJcIixcbiAgXCJrZWNjYWsyMjRcIixcbiAgXCJrZWNjYWsyNTZcIixcbiAgXCJrZWNjYWszODRcIixcbiAgXCJrZWNjYWs1MTJcIixcbl0gYXMgY29uc3Q7XG5leHBvcnQgdHlwZSBTdXBwb3J0ZWRBbGdvcml0aG0gPSB0eXBlb2Ygc3VwcG9ydGVkQWxnb3JpdGhtc1tudW1iZXJdO1xuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGBIYXNoYCBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0gYWxnb3JpdGhtIG5hbWUgb2YgaGFzaCBhbGdvcml0aG0gdG8gdXNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIYXNoKGFsZ29yaXRobTogU3VwcG9ydGVkQWxnb3JpdGhtKTogSGFzaGVyIHtcbiAgcmV0dXJuIG5ldyBIYXNoKGFsZ29yaXRobSBhcyBzdHJpbmcpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxTQUFTLElBQUksUUFBUSxpQkFBaUIsQ0FBQztBQUl2QyxPQUFPLE1BQU0sbUJBQW1CLEdBQUc7SUFDakMsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsV0FBVztJQUNYLFdBQVc7SUFDWCxNQUFNO0lBQ04sUUFBUTtJQUNSLFFBQVE7SUFDUixRQUFRO0lBQ1IsUUFBUTtJQUNSLFVBQVU7SUFDVixVQUFVO0lBQ1YsVUFBVTtJQUNWLFVBQVU7SUFDVixXQUFXO0lBQ1gsV0FBVztJQUNYLFdBQVc7SUFDWCxXQUFXO0NBQ1osQUFBUyxDQUFDO0FBRVg7Ozs7R0FJRyxDQUNILE9BQU8sU0FBUyxVQUFVLENBQUMsU0FBNkIsRUFBVTtJQUNoRSxPQUFPLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBVyxDQUFDO0NBQ3RDIn0=