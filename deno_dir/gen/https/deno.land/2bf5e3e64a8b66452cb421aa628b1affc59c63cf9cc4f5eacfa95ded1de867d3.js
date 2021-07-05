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
export function createHash(algorithm) {
    return new Hash(algorithm);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUl2QyxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRztJQUNqQyxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxXQUFXO0lBQ1gsV0FBVztJQUNYLE1BQU07SUFDTixRQUFRO0lBQ1IsUUFBUTtJQUNSLFFBQVE7SUFDUixRQUFRO0lBQ1IsVUFBVTtJQUNWLFVBQVU7SUFDVixVQUFVO0lBQ1YsVUFBVTtJQUNWLFdBQVc7SUFDWCxXQUFXO0lBQ1gsV0FBVztJQUNYLFdBQVc7Q0FDSCxDQUFDO0FBT1gsTUFBTSxVQUFVLFVBQVUsQ0FBQyxTQUE2QjtJQUN0RCxPQUFPLElBQUksSUFBSSxDQUFDLFNBQW1CLENBQUMsQ0FBQztBQUN2QyxDQUFDIn0=