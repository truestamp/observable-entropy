// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
const base64abc = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "/", 
];
/**
 * CREDIT: https://gist.github.com/enepomnyaschih/72c423f727d395eeaa09697058238727
 * Encodes a given Uint8Array, ArrayBuffer or string into RFC4648 base64 representation
 * @param data
 */ export function encode(data) {
    const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
    let result = "", i;
    const l = uint8.length;
    for(i = 2; i < l; i += 3){
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4 | uint8[i - 1] >> 4];
        result += base64abc[(uint8[i - 1] & 0x0f) << 2 | uint8[i] >> 6];
        result += base64abc[uint8[i] & 0x3f];
    }
    if (i === l + 1) {
        // 1 octet yet to write
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4];
        result += "==";
    }
    if (i === l) {
        // 2 octets yet to write
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4 | uint8[i - 1] >> 4];
        result += base64abc[(uint8[i - 1] & 0x0f) << 2];
        result += "=";
    }
    return result;
}
/**
 * Decodes a given RFC4648 base64 encoded string
 * @param b64
 */ export function decode(b64) {
    const binString = atob(b64);
    const size = binString.length;
    const bytes = new Uint8Array(size);
    for(let i = 0; i < size; i++){
        bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL2VuY29kaW5nL2Jhc2U2NC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5jb25zdCBiYXNlNjRhYmMgPSBbXG4gIFwiQVwiLFxuICBcIkJcIixcbiAgXCJDXCIsXG4gIFwiRFwiLFxuICBcIkVcIixcbiAgXCJGXCIsXG4gIFwiR1wiLFxuICBcIkhcIixcbiAgXCJJXCIsXG4gIFwiSlwiLFxuICBcIktcIixcbiAgXCJMXCIsXG4gIFwiTVwiLFxuICBcIk5cIixcbiAgXCJPXCIsXG4gIFwiUFwiLFxuICBcIlFcIixcbiAgXCJSXCIsXG4gIFwiU1wiLFxuICBcIlRcIixcbiAgXCJVXCIsXG4gIFwiVlwiLFxuICBcIldcIixcbiAgXCJYXCIsXG4gIFwiWVwiLFxuICBcIlpcIixcbiAgXCJhXCIsXG4gIFwiYlwiLFxuICBcImNcIixcbiAgXCJkXCIsXG4gIFwiZVwiLFxuICBcImZcIixcbiAgXCJnXCIsXG4gIFwiaFwiLFxuICBcImlcIixcbiAgXCJqXCIsXG4gIFwia1wiLFxuICBcImxcIixcbiAgXCJtXCIsXG4gIFwiblwiLFxuICBcIm9cIixcbiAgXCJwXCIsXG4gIFwicVwiLFxuICBcInJcIixcbiAgXCJzXCIsXG4gIFwidFwiLFxuICBcInVcIixcbiAgXCJ2XCIsXG4gIFwid1wiLFxuICBcInhcIixcbiAgXCJ5XCIsXG4gIFwielwiLFxuICBcIjBcIixcbiAgXCIxXCIsXG4gIFwiMlwiLFxuICBcIjNcIixcbiAgXCI0XCIsXG4gIFwiNVwiLFxuICBcIjZcIixcbiAgXCI3XCIsXG4gIFwiOFwiLFxuICBcIjlcIixcbiAgXCIrXCIsXG4gIFwiL1wiLFxuXTtcblxuLyoqXG4gKiBDUkVESVQ6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2VuZXBvbW55YXNjaGloLzcyYzQyM2Y3MjdkMzk1ZWVhYTA5Njk3MDU4MjM4NzI3XG4gKiBFbmNvZGVzIGEgZ2l2ZW4gVWludDhBcnJheSwgQXJyYXlCdWZmZXIgb3Igc3RyaW5nIGludG8gUkZDNDY0OCBiYXNlNjQgcmVwcmVzZW50YXRpb25cbiAqIEBwYXJhbSBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGUoZGF0YTogQXJyYXlCdWZmZXIgfCBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCB1aW50OCA9IHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiXG4gICAgPyBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoZGF0YSlcbiAgICA6IGRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5XG4gICAgPyBkYXRhXG4gICAgOiBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgbGV0IHJlc3VsdCA9IFwiXCIsXG4gICAgaTtcbiAgY29uc3QgbCA9IHVpbnQ4Lmxlbmd0aDtcbiAgZm9yIChpID0gMjsgaSA8IGw7IGkgKz0gMykge1xuICAgIHJlc3VsdCArPSBiYXNlNjRhYmNbdWludDhbaSAtIDJdID4+IDJdO1xuICAgIHJlc3VsdCArPSBiYXNlNjRhYmNbKCh1aW50OFtpIC0gMl0gJiAweDAzKSA8PCA0KSB8ICh1aW50OFtpIC0gMV0gPj4gNCldO1xuICAgIHJlc3VsdCArPSBiYXNlNjRhYmNbKCh1aW50OFtpIC0gMV0gJiAweDBmKSA8PCAyKSB8ICh1aW50OFtpXSA+PiA2KV07XG4gICAgcmVzdWx0ICs9IGJhc2U2NGFiY1t1aW50OFtpXSAmIDB4M2ZdO1xuICB9XG4gIGlmIChpID09PSBsICsgMSkge1xuICAgIC8vIDEgb2N0ZXQgeWV0IHRvIHdyaXRlXG4gICAgcmVzdWx0ICs9IGJhc2U2NGFiY1t1aW50OFtpIC0gMl0gPj4gMl07XG4gICAgcmVzdWx0ICs9IGJhc2U2NGFiY1sodWludDhbaSAtIDJdICYgMHgwMykgPDwgNF07XG4gICAgcmVzdWx0ICs9IFwiPT1cIjtcbiAgfVxuICBpZiAoaSA9PT0gbCkge1xuICAgIC8vIDIgb2N0ZXRzIHlldCB0byB3cml0ZVxuICAgIHJlc3VsdCArPSBiYXNlNjRhYmNbdWludDhbaSAtIDJdID4+IDJdO1xuICAgIHJlc3VsdCArPSBiYXNlNjRhYmNbKCh1aW50OFtpIC0gMl0gJiAweDAzKSA8PCA0KSB8ICh1aW50OFtpIC0gMV0gPj4gNCldO1xuICAgIHJlc3VsdCArPSBiYXNlNjRhYmNbKHVpbnQ4W2kgLSAxXSAmIDB4MGYpIDw8IDJdO1xuICAgIHJlc3VsdCArPSBcIj1cIjtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIERlY29kZXMgYSBnaXZlbiBSRkM0NjQ4IGJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICogQHBhcmFtIGI2NFxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlKGI2NDogc3RyaW5nKTogVWludDhBcnJheSB7XG4gIGNvbnN0IGJpblN0cmluZyA9IGF0b2IoYjY0KTtcbiAgY29uc3Qgc2l6ZSA9IGJpblN0cmluZy5sZW5ndGg7XG4gIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZTsgaSsrKSB7XG4gICAgYnl0ZXNbaV0gPSBiaW5TdHJpbmcuY2hhckNvZGVBdChpKTtcbiAgfVxuICByZXR1cm4gYnl0ZXM7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFDQUFxQztBQUVyQyxNQUFNLFNBQVMsR0FBRztJQUNoQixHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7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