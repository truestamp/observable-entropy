// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
// This module ports:
// - https://github.com/nodejs/node/blob/master/src/util-inl.h
// - https://github.com/nodejs/node/blob/master/src/util.cc
// - https://github.com/nodejs/node/blob/master/src/util.h
import { notImplemented } from "../_utils.ts";
export function guessHandleType(_fd) {
    notImplemented();
}
export const ALL_PROPERTIES = 0;
export const ONLY_WRITABLE = 1;
export const ONLY_ENUMERABLE = 2;
export const ONLY_CONFIGURABLE = 4;
export const ONLY_ENUM_WRITABLE = 6;
export const SKIP_STRINGS = 8;
export const SKIP_SYMBOLS = 16;
/**
 * Efficiently determine whether the provided property key is numeric
 * (and thus could be an array indexer) or not.
 *
 * Always returns true for values of type `'number'`.
 *
 * Otherwise, only returns true for strings that consist only of positive integers.
 *
 * Results are cached.
 */ const isNumericLookup = {};
export function isArrayIndex(value) {
    switch(typeof value){
        case "number":
            return value >= 0 && (value | 0) === value;
        case "string":
            {
                const result = isNumericLookup[value];
                if (result !== void 0) {
                    return result;
                }
                const length = value.length;
                if (length === 0) {
                    return isNumericLookup[value] = false;
                }
                let ch = 0;
                let i = 0;
                for(; i < length; ++i){
                    ch = value.charCodeAt(i);
                    if (i === 0 && ch === 0x30 && length > 1 /* must not start with 0 */  || ch < 0x30 /* 0 */  || ch > 0x39 /* 9 */ ) {
                        return isNumericLookup[value] = false;
                    }
                }
                return isNumericLookup[value] = true;
            }
        default:
            return false;
    }
}
export function getOwnNonIndexProperties(// deno-lint-ignore ban-types
obj, filter) {
    let allProperties = [
        ...Object.getOwnPropertyNames(obj),
        ...Object.getOwnPropertySymbols(obj), 
    ];
    if (Array.isArray(obj)) {
        allProperties = allProperties.filter((k)=>!isArrayIndex(k));
    }
    if (filter === ALL_PROPERTIES) {
        return allProperties;
    }
    const result = [];
    for (const key of allProperties){
        const desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc === undefined) {
            continue;
        }
        if (filter & ONLY_WRITABLE && !desc.writable) {
            continue;
        }
        if (filter & ONLY_ENUMERABLE && !desc.enumerable) {
            continue;
        }
        if (filter & ONLY_CONFIGURABLE && !desc.configurable) {
            continue;
        }
        if (filter & SKIP_STRINGS && typeof key === "string") {
            continue;
        }
        if (filter & SKIP_SYMBOLS && typeof key === "symbol") {
            continue;
        }
        result.push(key);
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvaW50ZXJuYWxfYmluZGluZy91dGlsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gVGhpcyBtb2R1bGUgcG9ydHM6XG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL21hc3Rlci9zcmMvdXRpbC1pbmwuaFxuLy8gLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvc3JjL3V0aWwuY2Ncbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvbWFzdGVyL3NyYy91dGlsLmhcblxuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi4vX3V0aWxzLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBndWVzc0hhbmRsZVR5cGUoX2ZkOiBudW1iZXIpOiBzdHJpbmcge1xuICBub3RJbXBsZW1lbnRlZCgpO1xufVxuXG5leHBvcnQgY29uc3QgQUxMX1BST1BFUlRJRVMgPSAwO1xuZXhwb3J0IGNvbnN0IE9OTFlfV1JJVEFCTEUgPSAxO1xuZXhwb3J0IGNvbnN0IE9OTFlfRU5VTUVSQUJMRSA9IDI7XG5leHBvcnQgY29uc3QgT05MWV9DT05GSUdVUkFCTEUgPSA0O1xuZXhwb3J0IGNvbnN0IE9OTFlfRU5VTV9XUklUQUJMRSA9IDY7XG5leHBvcnQgY29uc3QgU0tJUF9TVFJJTkdTID0gODtcbmV4cG9ydCBjb25zdCBTS0lQX1NZTUJPTFMgPSAxNjtcblxuLyoqXG4gKiBFZmZpY2llbnRseSBkZXRlcm1pbmUgd2hldGhlciB0aGUgcHJvdmlkZWQgcHJvcGVydHkga2V5IGlzIG51bWVyaWNcbiAqIChhbmQgdGh1cyBjb3VsZCBiZSBhbiBhcnJheSBpbmRleGVyKSBvciBub3QuXG4gKlxuICogQWx3YXlzIHJldHVybnMgdHJ1ZSBmb3IgdmFsdWVzIG9mIHR5cGUgYCdudW1iZXInYC5cbiAqXG4gKiBPdGhlcndpc2UsIG9ubHkgcmV0dXJucyB0cnVlIGZvciBzdHJpbmdzIHRoYXQgY29uc2lzdCBvbmx5IG9mIHBvc2l0aXZlIGludGVnZXJzLlxuICpcbiAqIFJlc3VsdHMgYXJlIGNhY2hlZC5cbiAqL1xuY29uc3QgaXNOdW1lcmljTG9va3VwOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHt9O1xuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXlJbmRleCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIG51bWJlciB8IHN0cmluZyB7XG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcmV0dXJuIHZhbHVlID49IDAgJiYgKHZhbHVlIHwgMCkgPT09IHZhbHVlO1xuICAgIGNhc2UgXCJzdHJpbmdcIjoge1xuICAgICAgY29uc3QgcmVzdWx0ID0gaXNOdW1lcmljTG9va3VwW3ZhbHVlXTtcbiAgICAgIGlmIChyZXN1bHQgIT09IHZvaWQgMCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgICAgY29uc3QgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgaWYgKGxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gaXNOdW1lcmljTG9va3VwW3ZhbHVlXSA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgbGV0IGNoID0gMDtcbiAgICAgIGxldCBpID0gMDtcbiAgICAgIGZvciAoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY2ggPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgaSA9PT0gMCAmJiBjaCA9PT0gMHgzMCAmJiBsZW5ndGggPiAxIC8qIG11c3Qgbm90IHN0YXJ0IHdpdGggMCAqLyB8fFxuICAgICAgICAgIGNoIDwgMHgzMCAvKiAwICovIHx8IGNoID4gMHgzOSAvKiA5ICovXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiBpc051bWVyaWNMb29rdXBbdmFsdWVdID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpc051bWVyaWNMb29rdXBbdmFsdWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3duTm9uSW5kZXhQcm9wZXJ0aWVzKFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuICBvYmo6IG9iamVjdCxcbiAgZmlsdGVyOiBudW1iZXIsXG4pOiAoc3RyaW5nIHwgc3ltYm9sKVtdIHtcbiAgbGV0IGFsbFByb3BlcnRpZXMgPSBbXG4gICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKSxcbiAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKG9iaiksXG4gIF07XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgIGFsbFByb3BlcnRpZXMgPSBhbGxQcm9wZXJ0aWVzLmZpbHRlcigoaykgPT4gIWlzQXJyYXlJbmRleChrKSk7XG4gIH1cblxuICBpZiAoZmlsdGVyID09PSBBTExfUFJPUEVSVElFUykge1xuICAgIHJldHVybiBhbGxQcm9wZXJ0aWVzO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0OiAoc3RyaW5nIHwgc3ltYm9sKVtdID0gW107XG4gIGZvciAoY29uc3Qga2V5IG9mIGFsbFByb3BlcnRpZXMpIHtcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIGtleSk7XG4gICAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChmaWx0ZXIgJiBPTkxZX1dSSVRBQkxFICYmICFkZXNjLndyaXRhYmxlKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGZpbHRlciAmIE9OTFlfRU5VTUVSQUJMRSAmJiAhZGVzYy5lbnVtZXJhYmxlKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGZpbHRlciAmIE9OTFlfQ09ORklHVVJBQkxFICYmICFkZXNjLmNvbmZpZ3VyYWJsZSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChmaWx0ZXIgJiBTS0lQX1NUUklOR1MgJiYgdHlwZW9mIGtleSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChmaWx0ZXIgJiBTS0lQX1NZTUJPTFMgJiYgdHlwZW9mIGtleSA9PT0gXCJzeW1ib2xcIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBQ3RELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ2hFLHNFQUFzRTtBQUN0RSxzRUFBc0U7QUFDdEUsNEVBQTRFO0FBQzVFLHFFQUFxRTtBQUNyRSx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSx5REFBeUQ7QUFDekQsRUFBRTtBQUNGLDBFQUEwRTtBQUMxRSw2REFBNkQ7QUFDN0QsNEVBQTRFO0FBQzVFLDJFQUEyRTtBQUMzRSx3RUFBd0U7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