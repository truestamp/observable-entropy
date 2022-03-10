import { bgGreen, bgRed, bold, gray, green, red, stripColor, white, } from "../fmt/colors.ts";
import { diff, diffstr, DiffType } from "./_diff.ts";
const CAN_NOT_DISPLAY = "[Cannot display]";
export class AssertionError extends Error {
    name = "AssertionError";
    constructor(message) {
        super(message);
    }
}
export function _format(v) {
    const { Deno } = globalThis;
    return typeof Deno?.inspect === "function"
        ? Deno.inspect(v, {
            depth: Infinity,
            sorted: true,
            trailingComma: true,
            compact: false,
            iterableLimit: Infinity,
        })
        : `"${String(v).replace(/(?=["\\])/g, "\\")}"`;
}
function createColor(diffType, { background = false } = {}) {
    switch (diffType) {
        case DiffType.added:
            return (s) => background ? bgGreen(white(s)) : green(bold(s));
        case DiffType.removed:
            return (s) => background ? bgRed(white(s)) : red(bold(s));
        default:
            return white;
    }
}
function createSign(diffType) {
    switch (diffType) {
        case DiffType.added:
            return "+   ";
        case DiffType.removed:
            return "-   ";
        default:
            return "    ";
    }
}
function buildMessage(diffResult, { stringDiff = false } = {}) {
    const messages = [], diffMessages = [];
    messages.push("");
    messages.push("");
    messages.push(`    ${gray(bold("[Diff]"))} ${red(bold("Actual"))} / ${green(bold("Expected"))}`);
    messages.push("");
    messages.push("");
    diffResult.forEach((result) => {
        const c = createColor(result.type);
        const line = result.details?.map((detail) => detail.type !== DiffType.common
            ? createColor(detail.type, { background: true })(detail.value)
            : detail.value).join("") ?? result.value;
        diffMessages.push(c(`${createSign(result.type)}${line}`));
    });
    messages.push(...(stringDiff ? [diffMessages.join("")] : diffMessages));
    messages.push("");
    return messages;
}
function isKeyedCollection(x) {
    return [Symbol.iterator, "size"].every((k) => k in x);
}
export function equal(c, d) {
    const seen = new Map();
    return (function compare(a, b) {
        if (a &&
            b &&
            ((a instanceof RegExp && b instanceof RegExp) ||
                (a instanceof URL && b instanceof URL))) {
            return String(a) === String(b);
        }
        if (a instanceof Date && b instanceof Date) {
            const aTime = a.getTime();
            const bTime = b.getTime();
            if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
                return true;
            }
            return aTime === bTime;
        }
        if (typeof a === "number" && typeof b === "number") {
            return Number.isNaN(a) && Number.isNaN(b) || a === b;
        }
        if (Object.is(a, b)) {
            return true;
        }
        if (a && typeof a === "object" && b && typeof b === "object") {
            if (a && b && !constructorsEqual(a, b)) {
                return false;
            }
            if (a instanceof WeakMap || b instanceof WeakMap) {
                if (!(a instanceof WeakMap && b instanceof WeakMap))
                    return false;
                throw new TypeError("cannot compare WeakMap instances");
            }
            if (a instanceof WeakSet || b instanceof WeakSet) {
                if (!(a instanceof WeakSet && b instanceof WeakSet))
                    return false;
                throw new TypeError("cannot compare WeakSet instances");
            }
            if (seen.get(a) === b) {
                return true;
            }
            if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
                return false;
            }
            if (isKeyedCollection(a) && isKeyedCollection(b)) {
                if (a.size !== b.size) {
                    return false;
                }
                let unmatchedEntries = a.size;
                for (const [aKey, aValue] of a.entries()) {
                    for (const [bKey, bValue] of b.entries()) {
                        if ((aKey === aValue && bKey === bValue && compare(aKey, bKey)) ||
                            (compare(aKey, bKey) && compare(aValue, bValue))) {
                            unmatchedEntries--;
                        }
                    }
                }
                return unmatchedEntries === 0;
            }
            const merged = { ...a, ...b };
            for (const key of [
                ...Object.getOwnPropertyNames(merged),
                ...Object.getOwnPropertySymbols(merged),
            ]) {
                if (!compare(a && a[key], b && b[key])) {
                    return false;
                }
                if (((key in a) && (!(key in b))) || ((key in b) && (!(key in a)))) {
                    return false;
                }
            }
            seen.set(a, b);
            if (a instanceof WeakRef || b instanceof WeakRef) {
                if (!(a instanceof WeakRef && b instanceof WeakRef))
                    return false;
                return compare(a.deref(), b.deref());
            }
            return true;
        }
        return false;
    })(c, d);
}
function constructorsEqual(a, b) {
    return a.constructor === b.constructor ||
        a.constructor === Object && !b.constructor ||
        !a.constructor && b.constructor === Object;
}
export function assert(expr, msg = "") {
    if (!expr) {
        throw new AssertionError(msg);
    }
}
export function assertEquals(actual, expected, msg) {
    if (equal(actual, expected)) {
        return;
    }
    let message = "";
    const actualString = _format(actual);
    const expectedString = _format(expected);
    try {
        const stringDiff = (typeof actual === "string") &&
            (typeof expected === "string");
        const diffResult = stringDiff
            ? diffstr(actual, expected)
            : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
        message = `Values are not equal:\n${diffMsg}`;
    }
    catch {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
    }
    if (msg) {
        message = msg;
    }
    throw new AssertionError(message);
}
export function assertNotEquals(actual, expected, msg) {
    if (!equal(actual, expected)) {
        return;
    }
    let actualString;
    let expectedString;
    try {
        actualString = String(actual);
    }
    catch {
        actualString = "[Cannot display]";
    }
    try {
        expectedString = String(expected);
    }
    catch {
        expectedString = "[Cannot display]";
    }
    if (!msg) {
        msg = `actual: ${actualString} expected not to be: ${expectedString}`;
    }
    throw new AssertionError(msg);
}
export function assertStrictEquals(actual, expected, msg) {
    if (actual === expected) {
        return;
    }
    let message;
    if (msg) {
        message = msg;
    }
    else {
        const actualString = _format(actual);
        const expectedString = _format(expected);
        if (actualString === expectedString) {
            const withOffset = actualString
                .split("\n")
                .map((l) => `    ${l}`)
                .join("\n");
            message =
                `Values have the same structure but are not reference-equal:\n\n${red(withOffset)}\n`;
        }
        else {
            try {
                const stringDiff = (typeof actual === "string") &&
                    (typeof expected === "string");
                const diffResult = stringDiff
                    ? diffstr(actual, expected)
                    : diff(actualString.split("\n"), expectedString.split("\n"));
                const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
                message = `Values are not strictly equal:\n${diffMsg}`;
            }
            catch {
                message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
            }
        }
    }
    throw new AssertionError(message);
}
export function assertNotStrictEquals(actual, expected, msg) {
    if (actual !== expected) {
        return;
    }
    throw new AssertionError(msg ?? `Expected "actual" to be strictly unequal to: ${_format(actual)}\n`);
}
export function assertAlmostEquals(actual, expected, tolerance = 1e-7, msg) {
    if (actual === expected) {
        return;
    }
    const delta = Math.abs(expected - actual);
    if (delta <= tolerance) {
        return;
    }
    const f = (n) => Number.isInteger(n) ? n : n.toExponential();
    throw new AssertionError(msg ??
        `actual: "${f(actual)}" expected to be close to "${f(expected)}": \
delta "${f(delta)}" is greater than "${f(tolerance)}"`);
}
export function assertExists(actual, msg) {
    if (actual === undefined || actual === null) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not be null or undefined`;
        }
        throw new AssertionError(msg);
    }
}
export function assertStringIncludes(actual, expected, msg) {
    if (!actual.includes(expected)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to contain: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
export function assertArrayIncludes(actual, expected, msg) {
    const missing = [];
    for (let i = 0; i < expected.length; i++) {
        let found = false;
        for (let j = 0; j < actual.length; j++) {
            if (equal(expected[i], actual[j])) {
                found = true;
                break;
            }
        }
        if (!found) {
            missing.push(expected[i]);
        }
    }
    if (missing.length === 0) {
        return;
    }
    if (!msg) {
        msg = `actual: "${_format(actual)}" expected to include: "${_format(expected)}"\nmissing: ${_format(missing)}`;
    }
    throw new AssertionError(msg);
}
export function assertMatch(actual, expected, msg) {
    if (!expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
export function assertNotMatch(actual, expected, msg) {
    if (expected.test(actual)) {
        if (!msg) {
            msg = `actual: "${actual}" expected to not match: "${expected}"`;
        }
        throw new AssertionError(msg);
    }
}
export function assertObjectMatch(actual, expected) {
    function filter(a, b) {
        const seen = new WeakMap();
        return fn(a, b);
        function fn(a, b) {
            if ((seen.has(a)) && (seen.get(a) === b)) {
                return a;
            }
            seen.set(a, b);
            const filtered = {};
            const entries = [
                ...Object.getOwnPropertyNames(a),
                ...Object.getOwnPropertySymbols(a),
            ]
                .filter((key) => key in b)
                .map((key) => [key, a[key]]);
            for (const [key, value] of entries) {
                if (Array.isArray(value)) {
                    const subset = b[key];
                    if (Array.isArray(subset)) {
                        filtered[key] = fn({ ...value }, { ...subset });
                        continue;
                    }
                }
                else if (value instanceof RegExp) {
                    filtered[key] = value;
                    continue;
                }
                else if (typeof value === "object") {
                    const subset = b[key];
                    if ((typeof subset === "object") && (subset)) {
                        if ((value instanceof Map) && (subset instanceof Map)) {
                            filtered[key] = new Map([...value].filter(([k]) => subset.has(k)).map(([k, v]) => [k, typeof v === "object" ? fn(v, subset.get(k)) : v]));
                            continue;
                        }
                        if ((value instanceof Set) && (subset instanceof Set)) {
                            filtered[key] = new Set([...value].filter((v) => subset.has(v)));
                            continue;
                        }
                        filtered[key] = fn(value, subset);
                        continue;
                    }
                }
                filtered[key] = value;
            }
            return filtered;
        }
    }
    return assertEquals(filter(actual, expected), filter(expected, expected));
}
export function fail(msg) {
    assert(false, `Failed assertion${msg ? `: ${msg}` : "."}`);
}
export function assertIsError(error, ErrorClass, msgIncludes, msg) {
    if (error instanceof Error === false) {
        throw new AssertionError(`Expected "error" to be an Error object.`);
    }
    if (ErrorClass && !(error instanceof ErrorClass)) {
        msg = `Expected error to be instance of "${ErrorClass.name}", but was "${typeof error === "object" ? error?.constructor?.name : "[not an object]"}"${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
    if (msgIncludes && (!(error instanceof Error) ||
        !stripColor(error.message).includes(stripColor(msgIncludes)))) {
        msg = `Expected error message to include "${msgIncludes}", but got "${error instanceof Error ? error.message : "[not an Error]"}"${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
}
export function assertThrows(fn, errorClassOrCallback, msgIncludesOrMsg, msg) {
    let ErrorClass = undefined;
    let msgIncludes = undefined;
    let errorCallback;
    if (errorClassOrCallback == null ||
        errorClassOrCallback.prototype instanceof Error ||
        errorClassOrCallback.prototype === Error.prototype) {
        ErrorClass = errorClassOrCallback;
        msgIncludes = msgIncludesOrMsg;
        errorCallback = null;
    }
    else {
        errorCallback = errorClassOrCallback;
        msg = msgIncludesOrMsg;
    }
    let doesThrow = false;
    try {
        fn();
    }
    catch (error) {
        if (error instanceof Error === false) {
            throw new AssertionError("A non-Error object was thrown.");
        }
        assertIsError(error, ErrorClass, msgIncludes, msg);
        if (typeof errorCallback == "function") {
            errorCallback(error);
        }
        doesThrow = true;
    }
    if (!doesThrow) {
        msg = `Expected function to throw${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
}
export async function assertRejects(fn, errorClassOrCallback, msgIncludesOrMsg, msg) {
    let ErrorClass = undefined;
    let msgIncludes = undefined;
    let errorCallback;
    if (errorClassOrCallback == null ||
        errorClassOrCallback.prototype instanceof Error ||
        errorClassOrCallback.prototype === Error.prototype) {
        ErrorClass = errorClassOrCallback;
        msgIncludes = msgIncludesOrMsg;
        errorCallback = null;
    }
    else {
        errorCallback = errorClassOrCallback;
        msg = msgIncludesOrMsg;
    }
    let doesThrow = false;
    try {
        await fn();
    }
    catch (error) {
        if (error instanceof Error === false) {
            throw new AssertionError("A non-Error object was thrown or rejected.");
        }
        assertIsError(error, ErrorClass, msgIncludes, msg);
        if (typeof errorCallback == "function") {
            errorCallback(error);
        }
        doesThrow = true;
    }
    if (!doesThrow) {
        msg = `Expected function to throw${msg ? `: ${msg}` : "."}`;
        throw new AssertionError(msg);
    }
}
export function unimplemented(msg) {
    throw new AssertionError(msg || "unimplemented");
}
export function unreachable() {
    throw new AssertionError("unreachable");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFzc2VydHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBSUEsT0FBTyxFQUNMLE9BQU8sRUFDUCxLQUFLLEVBQ0wsSUFBSSxFQUNKLElBQUksRUFDSixLQUFLLEVBQ0wsR0FBRyxFQUNILFVBQVUsRUFDVixLQUFLLEdBQ04sTUFBTSxrQkFBa0IsQ0FBQztBQUMxQixPQUFPLEVBQUUsSUFBSSxFQUFjLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFakUsTUFBTSxlQUFlLEdBQUcsa0JBQWtCLENBQUM7QUFFM0MsTUFBTSxPQUFPLGNBQWUsU0FBUSxLQUFLO0lBQzlCLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztJQUNqQyxZQUFZLE9BQWU7UUFDekIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pCLENBQUM7Q0FDRjtBQU9ELE1BQU0sVUFBVSxPQUFPLENBQUMsQ0FBVTtJQUVoQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsVUFBaUIsQ0FBQztJQUNuQyxPQUFPLE9BQU8sSUFBSSxFQUFFLE9BQU8sS0FBSyxVQUFVO1FBQ3hDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRTtZQUNoQixLQUFLLEVBQUUsUUFBUTtZQUNmLE1BQU0sRUFBRSxJQUFJO1lBQ1osYUFBYSxFQUFFLElBQUk7WUFDbkIsT0FBTyxFQUFFLEtBQUs7WUFDZCxhQUFhLEVBQUUsUUFBUTtTQUN4QixDQUFDO1FBQ0YsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUNuRCxDQUFDO0FBTUQsU0FBUyxXQUFXLENBQ2xCLFFBQWtCLEVBQ2xCLEVBQUUsVUFBVSxHQUFHLEtBQUssRUFBRSxHQUFHLEVBQUU7SUFFM0IsUUFBUSxRQUFRLEVBQUU7UUFDaEIsS0FBSyxRQUFRLENB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QWEsQ0FBQyxDQUFDO0FBQzFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLiBEbyBub3QgcmVseSBvbiBnb29kIGZvcm1hdHRpbmcgb2YgdmFsdWVzXG4vLyBmb3IgQXNzZXJ0aW9uRXJyb3IgbWVzc2FnZXMgaW4gYnJvd3NlcnMuXG5cbmltcG9ydCB7XG4gIGJnR3JlZW4sXG4gIGJnUmVkLFxuICBib2xkLFxuICBncmF5LFxuICBncmVlbixcbiAgcmVkLFxuICBzdHJpcENvbG9yLFxuICB3aGl0ZSxcbn0gZnJvbSBcIi4uL2ZtdC9jb2xvcnMudHNcIjtcbmltcG9ydCB7IGRpZmYsIERpZmZSZXN1bHQsIGRpZmZzdHIsIERpZmZUeXBlIH0gZnJvbSBcIi4vX2RpZmYudHNcIjtcblxuY29uc3QgQ0FOX05PVF9ESVNQTEFZID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG5cbmV4cG9ydCBjbGFzcyBBc3NlcnRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgb3ZlcnJpZGUgbmFtZSA9IFwiQXNzZXJ0aW9uRXJyb3JcIjtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgaW5wdXQgaW50byBhIHN0cmluZy4gT2JqZWN0cywgU2V0cyBhbmQgTWFwcyBhcmUgc29ydGVkIHNvIGFzIHRvXG4gKiBtYWtlIHRlc3RzIGxlc3MgZmxha3lcbiAqIEBwYXJhbSB2IFZhbHVlIHRvIGJlIGZvcm1hdHRlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gX2Zvcm1hdCh2OiB1bmtub3duKTogc3RyaW5nIHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgY29uc3QgeyBEZW5vIH0gPSBnbG9iYWxUaGlzIGFzIGFueTtcbiAgcmV0dXJuIHR5cGVvZiBEZW5vPy5pbnNwZWN0ID09PSBcImZ1bmN0aW9uXCJcbiAgICA/IERlbm8uaW5zcGVjdCh2LCB7XG4gICAgICBkZXB0aDogSW5maW5pdHksXG4gICAgICBzb3J0ZWQ6IHRydWUsXG4gICAgICB0cmFpbGluZ0NvbW1hOiB0cnVlLFxuICAgICAgY29tcGFjdDogZmFsc2UsXG4gICAgICBpdGVyYWJsZUxpbWl0OiBJbmZpbml0eSxcbiAgICB9KVxuICAgIDogYFwiJHtTdHJpbmcodikucmVwbGFjZSgvKD89W1wiXFxcXF0pL2csIFwiXFxcXFwiKX1cImA7XG59XG5cbi8qKlxuICogQ29sb3JzIHRoZSBvdXRwdXQgb2YgYXNzZXJ0aW9uIGRpZmZzXG4gKiBAcGFyYW0gZGlmZlR5cGUgRGlmZmVyZW5jZSB0eXBlLCBlaXRoZXIgYWRkZWQgb3IgcmVtb3ZlZFxuICovXG5mdW5jdGlvbiBjcmVhdGVDb2xvcihcbiAgZGlmZlR5cGU6IERpZmZUeXBlLFxuICB7IGJhY2tncm91bmQgPSBmYWxzZSB9ID0ge30sXG4pOiAoczogc3RyaW5nKSA9PiBzdHJpbmcge1xuICBzd2l0Y2ggKGRpZmZUeXBlKSB7XG4gICAgY2FzZSBEaWZmVHlwZS5hZGRlZDpcbiAgICAgIHJldHVybiAoczogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgICAgIGJhY2tncm91bmQgPyBiZ0dyZWVuKHdoaXRlKHMpKSA6IGdyZWVuKGJvbGQocykpO1xuICAgIGNhc2UgRGlmZlR5cGUucmVtb3ZlZDpcbiAgICAgIHJldHVybiAoczogc3RyaW5nKTogc3RyaW5nID0+IGJhY2tncm91bmQgPyBiZ1JlZCh3aGl0ZShzKSkgOiByZWQoYm9sZChzKSk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB3aGl0ZTtcbiAgfVxufVxuXG4vKipcbiAqIFByZWZpeGVzIGArYCBvciBgLWAgaW4gZGlmZiBvdXRwdXRcbiAqIEBwYXJhbSBkaWZmVHlwZSBEaWZmZXJlbmNlIHR5cGUsIGVpdGhlciBhZGRlZCBvciByZW1vdmVkXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVNpZ24oZGlmZlR5cGU6IERpZmZUeXBlKTogc3RyaW5nIHtcbiAgc3dpdGNoIChkaWZmVHlwZSkge1xuICAgIGNhc2UgRGlmZlR5cGUuYWRkZWQ6XG4gICAgICByZXR1cm4gXCIrICAgXCI7XG4gICAgY2FzZSBEaWZmVHlwZS5yZW1vdmVkOlxuICAgICAgcmV0dXJuIFwiLSAgIFwiO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gXCIgICAgXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gYnVpbGRNZXNzYWdlKFxuICBkaWZmUmVzdWx0OiBSZWFkb25seUFycmF5PERpZmZSZXN1bHQ8c3RyaW5nPj4sXG4gIHsgc3RyaW5nRGlmZiA9IGZhbHNlIH0gPSB7fSxcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgbWVzc2FnZXM6IHN0cmluZ1tdID0gW10sIGRpZmZNZXNzYWdlczogc3RyaW5nW10gPSBbXTtcbiAgbWVzc2FnZXMucHVzaChcIlwiKTtcbiAgbWVzc2FnZXMucHVzaChcIlwiKTtcbiAgbWVzc2FnZXMucHVzaChcbiAgICBgICAgICR7Z3JheShib2xkKFwiW0RpZmZdXCIpKX0gJHtyZWQoYm9sZChcIkFjdHVhbFwiKSl9IC8gJHtcbiAgICAgIGdyZWVuKGJvbGQoXCJFeHBlY3RlZFwiKSlcbiAgICB9YCxcbiAgKTtcbiAgbWVzc2FnZXMucHVzaChcIlwiKTtcbiAgbWVzc2FnZXMucHVzaChcIlwiKTtcbiAgZGlmZlJlc3VsdC5mb3JFYWNoKChyZXN1bHQ6IERpZmZSZXN1bHQ8c3RyaW5nPik6IHZvaWQgPT4ge1xuICAgIGNvbnN0IGMgPSBjcmVhdGVDb2xvcihyZXN1bHQudHlwZSk7XG4gICAgY29uc3QgbGluZSA9IHJlc3VsdC5kZXRhaWxzPy5tYXAoKGRldGFpbCkgPT5cbiAgICAgIGRldGFpbC50eXBlICE9PSBEaWZmVHlwZS5jb21tb25cbiAgICAgICAgPyBjcmVhdGVDb2xvcihkZXRhaWwudHlwZSwgeyBiYWNrZ3JvdW5kOiB0cnVlIH0pKGRldGFpbC52YWx1ZSlcbiAgICAgICAgOiBkZXRhaWwudmFsdWVcbiAgICApLmpvaW4oXCJcIikgPz8gcmVzdWx0LnZhbHVlO1xuICAgIGRpZmZNZXNzYWdlcy5wdXNoKGMoYCR7Y3JlYXRlU2lnbihyZXN1bHQudHlwZSl9JHtsaW5lfWApKTtcbiAgfSk7XG4gIG1lc3NhZ2VzLnB1c2goLi4uKHN0cmluZ0RpZmYgPyBbZGlmZk1lc3NhZ2VzLmpvaW4oXCJcIildIDogZGlmZk1lc3NhZ2VzKSk7XG4gIG1lc3NhZ2VzLnB1c2goXCJcIik7XG5cbiAgcmV0dXJuIG1lc3NhZ2VzO1xufVxuXG5mdW5jdGlvbiBpc0tleWVkQ29sbGVjdGlvbih4OiB1bmtub3duKTogeCBpcyBTZXQ8dW5rbm93bj4ge1xuICByZXR1cm4gW1N5bWJvbC5pdGVyYXRvciwgXCJzaXplXCJdLmV2ZXJ5KChrKSA9PiBrIGluICh4IGFzIFNldDx1bmtub3duPikpO1xufVxuXG4vKipcbiAqIERlZXAgZXF1YWxpdHkgY29tcGFyaXNvbiB1c2VkIGluIGFzc2VydGlvbnNcbiAqIEBwYXJhbSBjIGFjdHVhbCB2YWx1ZVxuICogQHBhcmFtIGQgZXhwZWN0ZWQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVxdWFsKGM6IHVua25vd24sIGQ6IHVua25vd24pOiBib29sZWFuIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBNYXAoKTtcbiAgcmV0dXJuIChmdW5jdGlvbiBjb21wYXJlKGE6IHVua25vd24sIGI6IHVua25vd24pOiBib29sZWFuIHtcbiAgICAvLyBIYXZlIHRvIHJlbmRlciBSZWdFeHAgJiBEYXRlIGZvciBzdHJpbmcgY29tcGFyaXNvblxuICAgIC8vIHVubGVzcyBpdCdzIG1pc3RyZWF0ZWQgYXMgb2JqZWN0XG4gICAgaWYgKFxuICAgICAgYSAmJlxuICAgICAgYiAmJlxuICAgICAgKChhIGluc3RhbmNlb2YgUmVnRXhwICYmIGIgaW5zdGFuY2VvZiBSZWdFeHApIHx8XG4gICAgICAgIChhIGluc3RhbmNlb2YgVVJMICYmIGIgaW5zdGFuY2VvZiBVUkwpKVxuICAgICkge1xuICAgICAgcmV0dXJuIFN0cmluZyhhKSA9PT0gU3RyaW5nKGIpO1xuICAgIH1cbiAgICBpZiAoYSBpbnN0YW5jZW9mIERhdGUgJiYgYiBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIGNvbnN0IGFUaW1lID0gYS5nZXRUaW1lKCk7XG4gICAgICBjb25zdCBiVGltZSA9IGIuZ2V0VGltZSgpO1xuICAgICAgLy8gQ2hlY2sgZm9yIE5hTiBlcXVhbGl0eSBtYW51YWxseSBzaW5jZSBOYU4gaXMgbm90XG4gICAgICAvLyBlcXVhbCB0byBpdHNlbGYuXG4gICAgICBpZiAoTnVtYmVyLmlzTmFOKGFUaW1lKSAmJiBOdW1iZXIuaXNOYU4oYlRpbWUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFUaW1lID09PSBiVGltZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhID09PSBcIm51bWJlclwiICYmIHR5cGVvZiBiID09PSBcIm51bWJlclwiKSB7XG4gICAgICByZXR1cm4gTnVtYmVyLmlzTmFOKGEpICYmIE51bWJlci5pc05hTihiKSB8fCBhID09PSBiO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmlzKGEsIGIpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGEgJiYgdHlwZW9mIGEgPT09IFwib2JqZWN0XCIgJiYgYiAmJiB0eXBlb2YgYiA9PT0gXCJvYmplY3RcIikge1xuICAgICAgaWYgKGEgJiYgYiAmJiAhY29uc3RydWN0b3JzRXF1YWwoYSwgYikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBXZWFrTWFwIHx8IGIgaW5zdGFuY2VvZiBXZWFrTWFwKSB7XG4gICAgICAgIGlmICghKGEgaW5zdGFuY2VvZiBXZWFrTWFwICYmIGIgaW5zdGFuY2VvZiBXZWFrTWFwKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGNvbXBhcmUgV2Vha01hcCBpbnN0YW5jZXNcIik7XG4gICAgICB9XG4gICAgICBpZiAoYSBpbnN0YW5jZW9mIFdlYWtTZXQgfHwgYiBpbnN0YW5jZW9mIFdlYWtTZXQpIHtcbiAgICAgICAgaWYgKCEoYSBpbnN0YW5jZW9mIFdlYWtTZXQgJiYgYiBpbnN0YW5jZW9mIFdlYWtTZXQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgY29tcGFyZSBXZWFrU2V0IGluc3RhbmNlc1wiKTtcbiAgICAgIH1cbiAgICAgIGlmIChzZWVuLmdldChhKSA9PT0gYikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChPYmplY3Qua2V5cyhhIHx8IHt9KS5sZW5ndGggIT09IE9iamVjdC5rZXlzKGIgfHwge30pLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoaXNLZXllZENvbGxlY3Rpb24oYSkgJiYgaXNLZXllZENvbGxlY3Rpb24oYikpIHtcbiAgICAgICAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVubWF0Y2hlZEVudHJpZXMgPSBhLnNpemU7XG5cbiAgICAgICAgZm9yIChjb25zdCBbYUtleSwgYVZhbHVlXSBvZiBhLmVudHJpZXMoKSkge1xuICAgICAgICAgIGZvciAoY29uc3QgW2JLZXksIGJWYWx1ZV0gb2YgYi5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgIC8qIEdpdmVuIHRoYXQgTWFwIGtleXMgY2FuIGJlIHJlZmVyZW5jZXMsIHdlIG5lZWRcbiAgICAgICAgICAgICAqIHRvIGVuc3VyZSB0aGF0IHRoZXkgYXJlIGFsc28gZGVlcGx5IGVxdWFsICovXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIChhS2V5ID09PSBhVmFsdWUgJiYgYktleSA9PT0gYlZhbHVlICYmIGNvbXBhcmUoYUtleSwgYktleSkpIHx8XG4gICAgICAgICAgICAgIChjb21wYXJlKGFLZXksIGJLZXkpICYmIGNvbXBhcmUoYVZhbHVlLCBiVmFsdWUpKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHVubWF0Y2hlZEVudHJpZXMtLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5tYXRjaGVkRW50cmllcyA9PT0gMDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG1lcmdlZCA9IHsgLi4uYSwgLi4uYiB9O1xuICAgICAgZm9yIChcbiAgICAgICAgY29uc3Qga2V5IG9mIFtcbiAgICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhtZXJnZWQpLFxuICAgICAgICAgIC4uLk9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMobWVyZ2VkKSxcbiAgICAgICAgXVxuICAgICAgKSB7XG4gICAgICAgIHR5cGUgS2V5ID0ga2V5b2YgdHlwZW9mIG1lcmdlZDtcbiAgICAgICAgaWYgKCFjb21wYXJlKGEgJiYgYVtrZXkgYXMgS2V5XSwgYiAmJiBiW2tleSBhcyBLZXldKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKChrZXkgaW4gYSkgJiYgKCEoa2V5IGluIGIpKSkgfHwgKChrZXkgaW4gYikgJiYgKCEoa2V5IGluIGEpKSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNlZW4uc2V0KGEsIGIpO1xuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBXZWFrUmVmIHx8IGIgaW5zdGFuY2VvZiBXZWFrUmVmKSB7XG4gICAgICAgIGlmICghKGEgaW5zdGFuY2VvZiBXZWFrUmVmICYmIGIgaW5zdGFuY2VvZiBXZWFrUmVmKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gY29tcGFyZShhLmRlcmVmKCksIGIuZGVyZWYoKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KShjLCBkKTtcbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbmZ1bmN0aW9uIGNvbnN0cnVjdG9yc0VxdWFsKGE6IG9iamVjdCwgYjogb2JqZWN0KSB7XG4gIHJldHVybiBhLmNvbnN0cnVjdG9yID09PSBiLmNvbnN0cnVjdG9yIHx8XG4gICAgYS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0ICYmICFiLmNvbnN0cnVjdG9yIHx8XG4gICAgIWEuY29uc3RydWN0b3IgJiYgYi5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0O1xufVxuXG4vKiogTWFrZSBhbiBhc3NlcnRpb24sIGVycm9yIHdpbGwgYmUgdGhyb3duIGlmIGBleHByYCBkb2VzIG5vdCBoYXZlIHRydXRoeSB2YWx1ZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnQoZXhwcjogdW5rbm93biwgbXNnID0gXCJcIik6IGFzc2VydHMgZXhwciB7XG4gIGlmICghZXhwcikge1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgZXF1YWwsIGRlZXBseS4gSWYgbm90XG4gKiBkZWVwbHkgZXF1YWwsIHRoZW4gdGhyb3cuXG4gKlxuICogVHlwZSBwYXJhbWV0ZXIgY2FuIGJlIHNwZWNpZmllZCB0byBlbnN1cmUgdmFsdWVzIHVuZGVyIGNvbXBhcmlzb24gaGF2ZSB0aGUgc2FtZSB0eXBlLlxuICogRm9yIGV4YW1wbGU6XG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0RXF1YWxzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEVxdWFsczxudW1iZXI+KDEsIDIpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEVxdWFscyhcbiAgYWN0dWFsOiB1bmtub3duLFxuICBleHBlY3RlZDogdW5rbm93bixcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFcXVhbHM8VD4oYWN0dWFsOiBULCBleHBlY3RlZDogVCwgbXNnPzogc3RyaW5nKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFcXVhbHMoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1zZz86IHN0cmluZyxcbik6IHZvaWQge1xuICBpZiAoZXF1YWwoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgbGV0IG1lc3NhZ2UgPSBcIlwiO1xuICBjb25zdCBhY3R1YWxTdHJpbmcgPSBfZm9ybWF0KGFjdHVhbCk7XG4gIGNvbnN0IGV4cGVjdGVkU3RyaW5nID0gX2Zvcm1hdChleHBlY3RlZCk7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RyaW5nRGlmZiA9ICh0eXBlb2YgYWN0dWFsID09PSBcInN0cmluZ1wiKSAmJlxuICAgICAgKHR5cGVvZiBleHBlY3RlZCA9PT0gXCJzdHJpbmdcIik7XG4gICAgY29uc3QgZGlmZlJlc3VsdCA9IHN0cmluZ0RpZmZcbiAgICAgID8gZGlmZnN0cihhY3R1YWwgYXMgc3RyaW5nLCBleHBlY3RlZCBhcyBzdHJpbmcpXG4gICAgICA6IGRpZmYoYWN0dWFsU3RyaW5nLnNwbGl0KFwiXFxuXCIpLCBleHBlY3RlZFN0cmluZy5zcGxpdChcIlxcblwiKSk7XG4gICAgY29uc3QgZGlmZk1zZyA9IGJ1aWxkTWVzc2FnZShkaWZmUmVzdWx0LCB7IHN0cmluZ0RpZmYgfSkuam9pbihcIlxcblwiKTtcbiAgICBtZXNzYWdlID0gYFZhbHVlcyBhcmUgbm90IGVxdWFsOlxcbiR7ZGlmZk1zZ31gO1xuICB9IGNhdGNoIHtcbiAgICBtZXNzYWdlID0gYFxcbiR7cmVkKENBTl9OT1RfRElTUExBWSl9ICsgXFxuXFxuYDtcbiAgfVxuICBpZiAobXNnKSB7XG4gICAgbWVzc2FnZSA9IG1zZztcbiAgfVxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgbm90IGVxdWFsLCBkZWVwbHkuXG4gKiBJZiBub3QgdGhlbiB0aHJvdy5cbiAqXG4gKiBUeXBlIHBhcmFtZXRlciBjYW4gYmUgc3BlY2lmaWVkIHRvIGVuc3VyZSB2YWx1ZXMgdW5kZXIgY29tcGFyaXNvbiBoYXZlIHRoZSBzYW1lIHR5cGUuXG4gKiBGb3IgZXhhbXBsZTpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnROb3RFcXVhbHMgfSBmcm9tIFwiLi9hc3NlcnRzLnRzXCI7XG4gKlxuICogYXNzZXJ0Tm90RXF1YWxzPG51bWJlcj4oMSwgMilcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90RXF1YWxzKFxuICBhY3R1YWw6IHVua25vd24sXG4gIGV4cGVjdGVkOiB1bmtub3duLFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdEVxdWFsczxUPihhY3R1YWw6IFQsIGV4cGVjdGVkOiBULCBtc2c/OiBzdHJpbmcpOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdEVxdWFscyhcbiAgYWN0dWFsOiB1bmtub3duLFxuICBleHBlY3RlZDogdW5rbm93bixcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmICghZXF1YWwoYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgbGV0IGFjdHVhbFN0cmluZzogc3RyaW5nO1xuICBsZXQgZXhwZWN0ZWRTdHJpbmc6IHN0cmluZztcbiAgdHJ5IHtcbiAgICBhY3R1YWxTdHJpbmcgPSBTdHJpbmcoYWN0dWFsKTtcbiAgfSBjYXRjaCB7XG4gICAgYWN0dWFsU3RyaW5nID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG4gIH1cbiAgdHJ5IHtcbiAgICBleHBlY3RlZFN0cmluZyA9IFN0cmluZyhleHBlY3RlZCk7XG4gIH0gY2F0Y2gge1xuICAgIGV4cGVjdGVkU3RyaW5nID0gXCJbQ2Fubm90IGRpc3BsYXldXCI7XG4gIH1cbiAgaWYgKCFtc2cpIHtcbiAgICBtc2cgPSBgYWN0dWFsOiAke2FjdHVhbFN0cmluZ30gZXhwZWN0ZWQgbm90IHRvIGJlOiAke2V4cGVjdGVkU3RyaW5nfWA7XG4gIH1cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgc3RyaWN0bHkgZXF1YWwuIElmXG4gKiBub3QgdGhlbiB0aHJvdy5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0U3RyaWN0RXF1YWxzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydFN0cmljdEVxdWFscygxLCAyKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRTdHJpY3RFcXVhbHM8VD4oXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IFQsXG4gIG1zZz86IHN0cmluZyxcbik6IGFzc2VydHMgYWN0dWFsIGlzIFQge1xuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cbiAgaWYgKG1zZykge1xuICAgIG1lc3NhZ2UgPSBtc2c7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYWN0dWFsU3RyaW5nID0gX2Zvcm1hdChhY3R1YWwpO1xuICAgIGNvbnN0IGV4cGVjdGVkU3RyaW5nID0gX2Zvcm1hdChleHBlY3RlZCk7XG5cbiAgICBpZiAoYWN0dWFsU3RyaW5nID09PSBleHBlY3RlZFN0cmluZykge1xuICAgICAgY29uc3Qgd2l0aE9mZnNldCA9IGFjdHVhbFN0cmluZ1xuICAgICAgICAuc3BsaXQoXCJcXG5cIilcbiAgICAgICAgLm1hcCgobCkgPT4gYCAgICAke2x9YClcbiAgICAgICAgLmpvaW4oXCJcXG5cIik7XG4gICAgICBtZXNzYWdlID1cbiAgICAgICAgYFZhbHVlcyBoYXZlIHRoZSBzYW1lIHN0cnVjdHVyZSBidXQgYXJlIG5vdCByZWZlcmVuY2UtZXF1YWw6XFxuXFxuJHtcbiAgICAgICAgICByZWQod2l0aE9mZnNldClcbiAgICAgICAgfVxcbmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0cmluZ0RpZmYgPSAodHlwZW9mIGFjdHVhbCA9PT0gXCJzdHJpbmdcIikgJiZcbiAgICAgICAgICAodHlwZW9mIGV4cGVjdGVkID09PSBcInN0cmluZ1wiKTtcbiAgICAgICAgY29uc3QgZGlmZlJlc3VsdCA9IHN0cmluZ0RpZmZcbiAgICAgICAgICA/IGRpZmZzdHIoYWN0dWFsIGFzIHN0cmluZywgZXhwZWN0ZWQgYXMgc3RyaW5nKVxuICAgICAgICAgIDogZGlmZihhY3R1YWxTdHJpbmcuc3BsaXQoXCJcXG5cIiksIGV4cGVjdGVkU3RyaW5nLnNwbGl0KFwiXFxuXCIpKTtcbiAgICAgICAgY29uc3QgZGlmZk1zZyA9IGJ1aWxkTWVzc2FnZShkaWZmUmVzdWx0LCB7IHN0cmluZ0RpZmYgfSkuam9pbihcIlxcblwiKTtcbiAgICAgICAgbWVzc2FnZSA9IGBWYWx1ZXMgYXJlIG5vdCBzdHJpY3RseSBlcXVhbDpcXG4ke2RpZmZNc2d9YDtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBtZXNzYWdlID0gYFxcbiR7cmVkKENBTl9OT1RfRElTUExBWSl9ICsgXFxuXFxuYDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBhbmQgYGV4cGVjdGVkYCBhcmUgbm90IHN0cmljdGx5IGVxdWFsLlxuICogSWYgdGhlIHZhbHVlcyBhcmUgc3RyaWN0bHkgZXF1YWwgdGhlbiB0aHJvdy5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0Tm90U3RyaWN0RXF1YWxzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydE5vdFN0cmljdEVxdWFscygxLCAxKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnROb3RTdHJpY3RFcXVhbHMoXG4gIGFjdHVhbDogdW5rbm93bixcbiAgZXhwZWN0ZWQ6IHVua25vd24sXG4gIG1zZz86IHN0cmluZyxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90U3RyaWN0RXF1YWxzPFQ+KFxuICBhY3R1YWw6IFQsXG4gIGV4cGVjdGVkOiBULFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE5vdFN0cmljdEVxdWFscyhcbiAgYWN0dWFsOiB1bmtub3duLFxuICBleHBlY3RlZDogdW5rbm93bixcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmIChhY3R1YWwgIT09IGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFxuICAgIG1zZyA/PyBgRXhwZWN0ZWQgXCJhY3R1YWxcIiB0byBiZSBzdHJpY3RseSB1bmVxdWFsIHRvOiAke19mb3JtYXQoYWN0dWFsKX1cXG5gLFxuICApO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgYW5kIGBleHBlY3RlZGAgYXJlIGFsbW9zdCBlcXVhbCBudW1iZXJzIHRocm91Z2hcbiAqIGEgZ2l2ZW4gdG9sZXJhbmNlLiBJdCBjYW4gYmUgdXNlZCB0byB0YWtlIGludG8gYWNjb3VudCBJRUVFLTc1NCBkb3VibGUtcHJlY2lzaW9uXG4gKiBmbG9hdGluZy1wb2ludCByZXByZXNlbnRhdGlvbiBsaW1pdGF0aW9ucy5cbiAqIElmIHRoZSB2YWx1ZXMgYXJlIG5vdCBhbG1vc3QgZXF1YWwgdGhlbiB0aHJvdy5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0QWxtb3N0RXF1YWxzLCBhc3NlcnRUaHJvd3MgfSBmcm9tIFwiLi9hc3NlcnRzLnRzXCI7XG4gKlxuICogYXNzZXJ0QWxtb3N0RXF1YWxzKDAuMSwgMC4yKTtcbiAqXG4gKiAvLyBVc2luZyBhIGN1c3RvbSB0b2xlcmFuY2UgdmFsdWVcbiAqIGFzc2VydEFsbW9zdEVxdWFscygwLjEgKyAwLjIsIDAuMywgMWUtMTYpO1xuICogYXNzZXJ0VGhyb3dzKCgpID0+IGFzc2VydEFsbW9zdEVxdWFscygwLjEgKyAwLjIsIDAuMywgMWUtMTcpKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QWxtb3N0RXF1YWxzKFxuICBhY3R1YWw6IG51bWJlcixcbiAgZXhwZWN0ZWQ6IG51bWJlcixcbiAgdG9sZXJhbmNlID0gMWUtNyxcbiAgbXNnPzogc3RyaW5nLFxuKSB7XG4gIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGRlbHRhID0gTWF0aC5hYnMoZXhwZWN0ZWQgLSBhY3R1YWwpO1xuICBpZiAoZGVsdGEgPD0gdG9sZXJhbmNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGYgPSAobjogbnVtYmVyKSA9PiBOdW1iZXIuaXNJbnRlZ2VyKG4pID8gbiA6IG4udG9FeHBvbmVudGlhbCgpO1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXG4gICAgbXNnID8/XG4gICAgICBgYWN0dWFsOiBcIiR7ZihhY3R1YWwpfVwiIGV4cGVjdGVkIHRvIGJlIGNsb3NlIHRvIFwiJHtmKGV4cGVjdGVkKX1cIjogXFxcbmRlbHRhIFwiJHtmKGRlbHRhKX1cIiBpcyBncmVhdGVyIHRoYW4gXCIke2YodG9sZXJhbmNlKX1cImAsXG4gICk7XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBhY3R1YWwgaXMgbm90IG51bGwgb3IgdW5kZWZpbmVkLlxuICogSWYgbm90IHRoZW4gdGhyb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFeGlzdHM8VD4oXG4gIGFjdHVhbDogVCxcbiAgbXNnPzogc3RyaW5nLFxuKTogYXNzZXJ0cyBhY3R1YWwgaXMgTm9uTnVsbGFibGU8VD4ge1xuICBpZiAoYWN0dWFsID09PSB1bmRlZmluZWQgfHwgYWN0dWFsID09PSBudWxsKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gbm90IGJlIG51bGwgb3IgdW5kZWZpbmVkYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGFjdHVhbCBpbmNsdWRlcyBleHBlY3RlZC4gSWYgbm90XG4gKiB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0U3RyaW5nSW5jbHVkZXMoXG4gIGFjdHVhbDogc3RyaW5nLFxuICBleHBlY3RlZDogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgaWYgKCFhY3R1YWwuaW5jbHVkZXMoZXhwZWN0ZWQpKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gY29udGFpbjogXCIke2V4cGVjdGVkfVwiYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIGluY2x1ZGVzIHRoZSBgZXhwZWN0ZWRgIHZhbHVlcy5cbiAqIElmIG5vdCB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICpcbiAqIFR5cGUgcGFyYW1ldGVyIGNhbiBiZSBzcGVjaWZpZWQgdG8gZW5zdXJlIHZhbHVlcyB1bmRlciBjb21wYXJpc29uIGhhdmUgdGhlIHNhbWUgdHlwZS5cbiAqIEZvciBleGFtcGxlOlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnRBcnJheUluY2x1ZGVzIH0gZnJvbSBcIi4vYXNzZXJ0cy50c1wiO1xuICpcbiAqIGFzc2VydEFycmF5SW5jbHVkZXM8bnVtYmVyPihbMSwgMl0sIFsyXSlcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QXJyYXlJbmNsdWRlcyhcbiAgYWN0dWFsOiBBcnJheUxpa2U8dW5rbm93bj4sXG4gIGV4cGVjdGVkOiBBcnJheUxpa2U8dW5rbm93bj4sXG4gIG1zZz86IHN0cmluZyxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QXJyYXlJbmNsdWRlczxUPihcbiAgYWN0dWFsOiBBcnJheUxpa2U8VD4sXG4gIGV4cGVjdGVkOiBBcnJheUxpa2U8VD4sXG4gIG1zZz86IHN0cmluZyxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0QXJyYXlJbmNsdWRlcyhcbiAgYWN0dWFsOiBBcnJheUxpa2U8dW5rbm93bj4sXG4gIGV4cGVjdGVkOiBBcnJheUxpa2U8dW5rbm93bj4sXG4gIG1zZz86IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBtaXNzaW5nOiB1bmtub3duW10gPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBlY3RlZC5sZW5ndGg7IGkrKykge1xuICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgYWN0dWFsLmxlbmd0aDsgaisrKSB7XG4gICAgICBpZiAoZXF1YWwoZXhwZWN0ZWRbaV0sIGFjdHVhbFtqXSkpIHtcbiAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFmb3VuZCkge1xuICAgICAgbWlzc2luZy5wdXNoKGV4cGVjdGVkW2ldKTtcbiAgICB9XG4gIH1cbiAgaWYgKG1pc3NpbmcubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghbXNnKSB7XG4gICAgbXNnID0gYGFjdHVhbDogXCIke19mb3JtYXQoYWN0dWFsKX1cIiBleHBlY3RlZCB0byBpbmNsdWRlOiBcIiR7XG4gICAgICBfZm9ybWF0KGV4cGVjdGVkKVxuICAgIH1cIlxcbm1pc3Npbmc6ICR7X2Zvcm1hdChtaXNzaW5nKX1gO1xuICB9XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xufVxuXG4vKipcbiAqIE1ha2UgYW4gYXNzZXJ0aW9uIHRoYXQgYGFjdHVhbGAgbWF0Y2ggUmVnRXhwIGBleHBlY3RlZGAuIElmIG5vdFxuICogdGhlbiB0aHJvdy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydE1hdGNoKFxuICBhY3R1YWw6IHN0cmluZyxcbiAgZXhwZWN0ZWQ6IFJlZ0V4cCxcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmICghZXhwZWN0ZWQudGVzdChhY3R1YWwpKSB7XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIG1zZyA9IGBhY3R1YWw6IFwiJHthY3R1YWx9XCIgZXhwZWN0ZWQgdG8gbWF0Y2g6IFwiJHtleHBlY3RlZH1cImA7XG4gICAgfVxuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKlxuICogTWFrZSBhbiBhc3NlcnRpb24gdGhhdCBgYWN0dWFsYCBub3QgbWF0Y2ggUmVnRXhwIGBleHBlY3RlZGAuIElmIG1hdGNoXG4gKiB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0Tm90TWF0Y2goXG4gIGFjdHVhbDogc3RyaW5nLFxuICBleHBlY3RlZDogUmVnRXhwLFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgaWYgKGV4cGVjdGVkLnRlc3QoYWN0dWFsKSkge1xuICAgIGlmICghbXNnKSB7XG4gICAgICBtc2cgPSBgYWN0dWFsOiBcIiR7YWN0dWFsfVwiIGV4cGVjdGVkIHRvIG5vdCBtYXRjaDogXCIke2V4cGVjdGVkfVwiYDtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBhY3R1YWxgIG9iamVjdCBpcyBhIHN1YnNldCBvZiBgZXhwZWN0ZWRgIG9iamVjdCwgZGVlcGx5LlxuICogSWYgbm90LCB0aGVuIHRocm93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0T2JqZWN0TWF0Y2goXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGFjdHVhbDogUmVjb3JkPFByb3BlcnR5S2V5LCBhbnk+LFxuICBleHBlY3RlZDogUmVjb3JkPFByb3BlcnR5S2V5LCB1bmtub3duPixcbik6IHZvaWQge1xuICB0eXBlIGxvb3NlID0gUmVjb3JkPFByb3BlcnR5S2V5LCB1bmtub3duPjtcblxuICBmdW5jdGlvbiBmaWx0ZXIoYTogbG9vc2UsIGI6IGxvb3NlKSB7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBXZWFrTWFwKCk7XG4gICAgcmV0dXJuIGZuKGEsIGIpO1xuXG4gICAgZnVuY3Rpb24gZm4oYTogbG9vc2UsIGI6IGxvb3NlKTogbG9vc2Uge1xuICAgICAgLy8gUHJldmVudCBpbmZpbml0ZSBsb29wIHdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcyB3aXRoIHNhbWUgZmlsdGVyXG4gICAgICBpZiAoKHNlZW4uaGFzKGEpKSAmJiAoc2Vlbi5nZXQoYSkgPT09IGIpKSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgICAgfVxuICAgICAgc2Vlbi5zZXQoYSwgYik7XG4gICAgICAvLyBGaWx0ZXIga2V5cyBhbmQgc3ltYm9scyB3aGljaCBhcmUgcHJlc2VudCBpbiBib3RoIGFjdHVhbCBhbmQgZXhwZWN0ZWRcbiAgICAgIGNvbnN0IGZpbHRlcmVkID0ge30gYXMgbG9vc2U7XG4gICAgICBjb25zdCBlbnRyaWVzID0gW1xuICAgICAgICAuLi5PYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhKSxcbiAgICAgICAgLi4uT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhhKSxcbiAgICAgIF1cbiAgICAgICAgLmZpbHRlcigoa2V5KSA9PiBrZXkgaW4gYilcbiAgICAgICAgLm1hcCgoa2V5KSA9PiBba2V5LCBhW2tleSBhcyBzdHJpbmddXSkgYXMgQXJyYXk8W3N0cmluZywgdW5rbm93bl0+O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZW50cmllcykge1xuICAgICAgICAvLyBPbiBhcnJheSByZWZlcmVuY2VzLCBidWlsZCBhIGZpbHRlcmVkIGFycmF5IGFuZCBmaWx0ZXIgbmVzdGVkIG9iamVjdHMgaW5zaWRlXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIGNvbnN0IHN1YnNldCA9IChiIGFzIGxvb3NlKVtrZXldO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHN1YnNldCkpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkW2tleV0gPSBmbih7IC4uLnZhbHVlIH0sIHsgLi4uc3Vic2V0IH0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IC8vIE9uIHJlZ2V4cCByZWZlcmVuY2VzLCBrZWVwIHZhbHVlIGFzIGl0IHRvIGF2b2lkIGxvb3NpbmcgcGF0dGVybiBhbmQgZmxhZ3NcbiAgICAgICAgZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gdmFsdWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gLy8gT24gbmVzdGVkIG9iamVjdHMgcmVmZXJlbmNlcywgYnVpbGQgYSBmaWx0ZXJlZCBvYmplY3QgcmVjdXJzaXZlbHlcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgY29uc3Qgc3Vic2V0ID0gKGIgYXMgbG9vc2UpW2tleV07XG4gICAgICAgICAgaWYgKCh0eXBlb2Ygc3Vic2V0ID09PSBcIm9iamVjdFwiKSAmJiAoc3Vic2V0KSkge1xuICAgICAgICAgICAgLy8gV2hlbiBib3RoIG9wZXJhbmRzIGFyZSBtYXBzLCBidWlsZCBhIGZpbHRlcmVkIG1hcCB3aXRoIGNvbW1vbiBrZXlzIGFuZCBmaWx0ZXIgbmVzdGVkIG9iamVjdHMgaW5zaWRlXG4gICAgICAgICAgICBpZiAoKHZhbHVlIGluc3RhbmNlb2YgTWFwKSAmJiAoc3Vic2V0IGluc3RhbmNlb2YgTWFwKSkge1xuICAgICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gbmV3IE1hcChcbiAgICAgICAgICAgICAgICBbLi4udmFsdWVdLmZpbHRlcigoW2tdKSA9PiBzdWJzZXQuaGFzKGspKS5tYXAoKFxuICAgICAgICAgICAgICAgICAgW2ssIHZdLFxuICAgICAgICAgICAgICAgICkgPT4gW2ssIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiID8gZm4odiwgc3Vic2V0LmdldChrKSkgOiB2XSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gV2hlbiBib3RoIG9wZXJhbmRzIGFyZSBzZXQsIGJ1aWxkIGEgZmlsdGVyZWQgc2V0IHdpdGggY29tbW9uIHZhbHVlc1xuICAgICAgICAgICAgaWYgKCh2YWx1ZSBpbnN0YW5jZW9mIFNldCkgJiYgKHN1YnNldCBpbnN0YW5jZW9mIFNldCkpIHtcbiAgICAgICAgICAgICAgZmlsdGVyZWRba2V5XSA9IG5ldyBTZXQoWy4uLnZhbHVlXS5maWx0ZXIoKHYpID0+IHN1YnNldC5oYXModikpKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaWx0ZXJlZFtrZXldID0gZm4odmFsdWUgYXMgbG9vc2UsIHN1YnNldCBhcyBsb29zZSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZmlsdGVyZWRba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZpbHRlcmVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYXNzZXJ0RXF1YWxzKFxuICAgIC8vIGdldCB0aGUgaW50ZXJzZWN0aW9uIG9mIFwiYWN0dWFsXCIgYW5kIFwiZXhwZWN0ZWRcIlxuICAgIC8vIHNpZGUgZWZmZWN0OiBhbGwgdGhlIGluc3RhbmNlcycgY29uc3RydWN0b3IgZmllbGQgaXMgXCJPYmplY3RcIiBub3cuXG4gICAgZmlsdGVyKGFjdHVhbCwgZXhwZWN0ZWQpLFxuICAgIC8vIHNldCAobmVzdGVkKSBpbnN0YW5jZXMnIGNvbnN0cnVjdG9yIGZpZWxkIHRvIGJlIFwiT2JqZWN0XCIgd2l0aG91dCBjaGFuZ2luZyBleHBlY3RlZCB2YWx1ZS5cbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2Rlbm9sYW5kL2Rlbm9fc3RkL3B1bGwvMTQxOVxuICAgIGZpbHRlcihleHBlY3RlZCwgZXhwZWN0ZWQpLFxuICApO1xufVxuXG4vKipcbiAqIEZvcmNlZnVsbHkgdGhyb3dzIGEgZmFpbGVkIGFzc2VydGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gZmFpbChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIGFzc2VydChmYWxzZSwgYEZhaWxlZCBhc3NlcnRpb24ke21zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIn1gKTtcbn1cblxuLyoqXG4gKiBNYWtlIGFuIGFzc2VydGlvbiB0aGF0IGBlcnJvcmAgaXMgYW4gYEVycm9yYC5cbiAqIElmIG5vdCB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duLlxuICogQW4gZXJyb3IgY2xhc3MgYW5kIGEgc3RyaW5nIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZVxuICogZXJyb3IgbWVzc2FnZSBjYW4gYWxzbyBiZSBhc3NlcnRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydElzRXJyb3I8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBlcnJvcjogdW5rbm93bixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzcz86IG5ldyAoLi4uYXJnczogYW55W10pID0+IEUsXG4gIG1zZ0luY2x1ZGVzPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiBhc3NlcnRzIGVycm9yIGlzIEUge1xuICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA9PT0gZmFsc2UpIHtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoYEV4cGVjdGVkIFwiZXJyb3JcIiB0byBiZSBhbiBFcnJvciBvYmplY3QuYCk7XG4gIH1cbiAgaWYgKEVycm9yQ2xhc3MgJiYgIShlcnJvciBpbnN0YW5jZW9mIEVycm9yQ2xhc3MpKSB7XG4gICAgbXNnID0gYEV4cGVjdGVkIGVycm9yIHRvIGJlIGluc3RhbmNlIG9mIFwiJHtFcnJvckNsYXNzLm5hbWV9XCIsIGJ1dCB3YXMgXCIke1xuICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiID8gZXJyb3I/LmNvbnN0cnVjdG9yPy5uYW1lIDogXCJbbm90IGFuIG9iamVjdF1cIlxuICAgIH1cIiR7bXNnID8gYDogJHttc2d9YCA6IFwiLlwifWA7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbiAgaWYgKFxuICAgIG1zZ0luY2x1ZGVzICYmICghKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHx8XG4gICAgICAhc3RyaXBDb2xvcihlcnJvci5tZXNzYWdlKS5pbmNsdWRlcyhzdHJpcENvbG9yKG1zZ0luY2x1ZGVzKSkpXG4gICkge1xuICAgIG1zZyA9IGBFeHBlY3RlZCBlcnJvciBtZXNzYWdlIHRvIGluY2x1ZGUgXCIke21zZ0luY2x1ZGVzfVwiLCBidXQgZ290IFwiJHtcbiAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJbbm90IGFuIEVycm9yXVwiXG4gICAgfVwiJHttc2cgPyBgOiAke21zZ31gIDogXCIuXCJ9YDtcbiAgICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IobXNnKTtcbiAgfVxufVxuXG4vKipcbiAqIEV4ZWN1dGVzIGEgZnVuY3Rpb24sIGV4cGVjdGluZyBpdCB0byB0aHJvdy4gIElmIGl0IGRvZXMgbm90LCB0aGVuIGl0XG4gKiB0aHJvd3MuIEFuIGVycm9yIGNsYXNzIGFuZCBhIHN0cmluZyB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGVcbiAqIGVycm9yIG1lc3NhZ2UgY2FuIGFsc28gYmUgYXNzZXJ0ZWQuIE9yIHlvdSBjYW4gcGFzcyBhXG4gKiBjYWxsYmFjayB3aGljaCB3aWxsIGJlIHBhc3NlZCB0aGUgZXJyb3IsIHVzdWFsbHkgdG8gYXBwbHkgc29tZSBjdXN0b21cbiAqIGFzc2VydGlvbnMgb24gaXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3M8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgRXJyb3JDbGFzcz86IG5ldyAoLi4uYXJnczogYW55W10pID0+IEUsXG4gIG1zZ0luY2x1ZGVzPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFRocm93cyhcbiAgZm46ICgpID0+IHVua25vd24sXG4gIGVycm9yQ2FsbGJhY2s6IChlOiBFcnJvcikgPT4gdW5rbm93bixcbiAgbXNnPzogc3RyaW5nLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUaHJvd3M8RSBleHRlbmRzIEVycm9yID0gRXJyb3I+KFxuICBmbjogKCkgPT4gdW5rbm93bixcbiAgZXJyb3JDbGFzc09yQ2FsbGJhY2s/OlxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgfCAobmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSlcbiAgICB8ICgoZTogRXJyb3IpID0+IHVua25vd24pLFxuICBtc2dJbmNsdWRlc09yTXNnPzogc3RyaW5nLFxuICBtc2c/OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgbGV0IEVycm9yQ2xhc3M6IChuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBFKSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgbGV0IG1zZ0luY2x1ZGVzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBlcnJvckNhbGxiYWNrO1xuICBpZiAoXG4gICAgZXJyb3JDbGFzc09yQ2FsbGJhY2sgPT0gbnVsbCB8fFxuICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrLnByb3RvdHlwZSBpbnN0YW5jZW9mIEVycm9yIHx8XG4gICAgZXJyb3JDbGFzc09yQ2FsbGJhY2sucHJvdG90eXBlID09PSBFcnJvci5wcm90b3R5cGVcbiAgKSB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBFcnJvckNsYXNzID0gZXJyb3JDbGFzc09yQ2FsbGJhY2sgYXMgbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRTtcbiAgICBtc2dJbmNsdWRlcyA9IG1zZ0luY2x1ZGVzT3JNc2c7XG4gICAgZXJyb3JDYWxsYmFjayA9IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgZXJyb3JDYWxsYmFjayA9IGVycm9yQ2xhc3NPckNhbGxiYWNrIGFzIChlOiBFcnJvcikgPT4gdW5rbm93bjtcbiAgICBtc2cgPSBtc2dJbmNsdWRlc09yTXNnO1xuICB9XG4gIGxldCBkb2VzVGhyb3cgPSBmYWxzZTtcbiAgdHJ5IHtcbiAgICBmbigpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID09PSBmYWxzZSkge1xuICAgICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKFwiQSBub24tRXJyb3Igb2JqZWN0IHdhcyB0aHJvd24uXCIpO1xuICAgIH1cbiAgICBhc3NlcnRJc0Vycm9yKFxuICAgICAgZXJyb3IsXG4gICAgICBFcnJvckNsYXNzLFxuICAgICAgbXNnSW5jbHVkZXMsXG4gICAgICBtc2csXG4gICAgKTtcbiAgICBpZiAodHlwZW9mIGVycm9yQ2FsbGJhY2sgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBlcnJvckNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG4gICAgZG9lc1Rocm93ID0gdHJ1ZTtcbiAgfVxuICBpZiAoIWRvZXNUaHJvdykge1xuICAgIG1zZyA9IGBFeHBlY3RlZCBmdW5jdGlvbiB0byB0aHJvdyR7bXNnID8gYDogJHttc2d9YCA6IFwiLlwifWA7XG4gICAgdGhyb3cgbmV3IEFzc2VydGlvbkVycm9yKG1zZyk7XG4gIH1cbn1cblxuLyoqXG4gKiBFeGVjdXRlcyBhIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYSBwcm9taXNlLCBleHBlY3RpbmcgaXQgdG8gdGhyb3cgb3IgcmVqZWN0LlxuICogSWYgaXQgZG9lcyBub3QsIHRoZW4gaXQgdGhyb3dzLiBBbiBlcnJvciBjbGFzcyBhbmQgYSBzdHJpbmcgdGhhdCBzaG91bGQgYmVcbiAqIGluY2x1ZGVkIGluIHRoZSBlcnJvciBtZXNzYWdlIGNhbiBhbHNvIGJlIGFzc2VydGVkLiBPciB5b3UgY2FuIHBhc3MgYVxuICogY2FsbGJhY2sgd2hpY2ggd2lsbCBiZSBwYXNzZWQgdGhlIGVycm9yLCB1c3VhbGx5IHRvIGFwcGx5IHNvbWUgY3VzdG9tXG4gKiBhc3NlcnRpb25zIG9uIGl0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0czxFIGV4dGVuZHMgRXJyb3IgPSBFcnJvcj4oXG4gIGZuOiAoKSA9PiBQcm9taXNlPHVua25vd24+LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBFcnJvckNsYXNzPzogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSxcbiAgbXNnSW5jbHVkZXM/OiBzdHJpbmcsXG4gIG1zZz86IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD47XG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UmVqZWN0cyhcbiAgZm46ICgpID0+IFByb21pc2U8dW5rbm93bj4sXG4gIGVycm9yQ2FsbGJhY2s6IChlOiBFcnJvcikgPT4gdW5rbm93bixcbiAgbXNnPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhc3NlcnRSZWplY3RzPEUgZXh0ZW5kcyBFcnJvciA9IEVycm9yPihcbiAgZm46ICgpID0+IFByb21pc2U8dW5rbm93bj4sXG4gIGVycm9yQ2xhc3NPckNhbGxiYWNrPzpcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHwgKG5ldyAoLi4uYXJnczogYW55W10pID0+IEUpXG4gICAgfCAoKGU6IEVycm9yKSA9PiB1bmtub3duKSxcbiAgbXNnSW5jbHVkZXNPck1zZz86IHN0cmluZyxcbiAgbXNnPzogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGxldCBFcnJvckNsYXNzOiAobmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gRSkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGxldCBtc2dJbmNsdWRlczogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgZXJyb3JDYWxsYmFjaztcbiAgaWYgKFxuICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrID09IG51bGwgfHxcbiAgICBlcnJvckNsYXNzT3JDYWxsYmFjay5wcm90b3R5cGUgaW5zdGFuY2VvZiBFcnJvciB8fFxuICAgIGVycm9yQ2xhc3NPckNhbGxiYWNrLnByb3RvdHlwZSA9PT0gRXJyb3IucHJvdG90eXBlXG4gICkge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgRXJyb3JDbGFzcyA9IGVycm9yQ2xhc3NPckNhbGxiYWNrIGFzIG5ldyAoLi4uYXJnczogYW55W10pID0+IEU7XG4gICAgbXNnSW5jbHVkZXMgPSBtc2dJbmNsdWRlc09yTXNnO1xuICAgIGVycm9yQ2FsbGJhY2sgPSBudWxsO1xuICB9IGVsc2Uge1xuICAgIGVycm9yQ2FsbGJhY2sgPSBlcnJvckNsYXNzT3JDYWxsYmFjayBhcyAoZTogRXJyb3IpID0+IHVua25vd247XG4gICAgbXNnID0gbXNnSW5jbHVkZXNPck1zZztcbiAgfVxuICBsZXQgZG9lc1Rocm93ID0gZmFsc2U7XG4gIHRyeSB7XG4gICAgYXdhaXQgZm4oKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA9PT0gZmFsc2UpIHtcbiAgICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihcIkEgbm9uLUVycm9yIG9iamVjdCB3YXMgdGhyb3duIG9yIHJlamVjdGVkLlwiKTtcbiAgICB9XG4gICAgYXNzZXJ0SXNFcnJvcihcbiAgICAgIGVycm9yLFxuICAgICAgRXJyb3JDbGFzcyxcbiAgICAgIG1zZ0luY2x1ZGVzLFxuICAgICAgbXNnLFxuICAgICk7XG4gICAgaWYgKHR5cGVvZiBlcnJvckNhbGxiYWNrID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgZXJyb3JDYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICAgIGRvZXNUaHJvdyA9IHRydWU7XG4gIH1cbiAgaWYgKCFkb2VzVGhyb3cpIHtcbiAgICBtc2cgPSBgRXhwZWN0ZWQgZnVuY3Rpb24gdG8gdGhyb3cke21zZyA/IGA6ICR7bXNnfWAgOiBcIi5cIn1gO1xuICAgIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cpO1xuICB9XG59XG5cbi8qKiBVc2UgdGhpcyB0byBzdHViIG91dCBtZXRob2RzIHRoYXQgd2lsbCB0aHJvdyB3aGVuIGludm9rZWQuICovXG5leHBvcnQgZnVuY3Rpb24gdW5pbXBsZW1lbnRlZChtc2c/OiBzdHJpbmcpOiBuZXZlciB7XG4gIHRocm93IG5ldyBBc3NlcnRpb25FcnJvcihtc2cgfHwgXCJ1bmltcGxlbWVudGVkXCIpO1xufVxuXG4vKiogVXNlIHRoaXMgdG8gYXNzZXJ0IHVucmVhY2hhYmxlIGNvZGUuICovXG5leHBvcnQgZnVuY3Rpb24gdW5yZWFjaGFibGUoKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgQXNzZXJ0aW9uRXJyb3IoXCJ1bnJlYWNoYWJsZVwiKTtcbn1cbiJdfQ==