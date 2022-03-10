import { CHAR_BACKWARD_SLASH, CHAR_COLON, CHAR_DOT, CHAR_QUESTION_MARK, } from "./_constants.ts";
import { _format, assertPath, encodeWhitespace, isPathSeparator, isWindowsDeviceRoot, normalizeString, } from "./_util.ts";
import { assert } from "../_util/assert.ts";
export const sep = "\\";
export const delimiter = ";";
export function resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for (let i = pathSegments.length - 1; i >= -1; i--) {
        let path;
        const { Deno } = globalThis;
        if (i >= 0) {
            path = pathSegments[i];
        }
        else if (!resolvedDevice) {
            if (typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a drive-letter-less path without a CWD.");
            }
            path = Deno.cwd();
        }
        else {
            if (typeof Deno?.env?.get !== "function" || typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno.cwd();
            if (path === undefined ||
                path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
                path = `${resolvedDevice}\\`;
            }
        }
        assertPath(path);
        const len = path.length;
        if (len === 0)
            continue;
        let rootEnd = 0;
        let device = "";
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        if (len > 1) {
            if (isPathSeparator(code)) {
                isAbsolute = true;
                if (isPathSeparator(path.charCodeAt(1))) {
                    let j = 2;
                    let last = j;
                    for (; j < len; ++j) {
                        if (isPathSeparator(path.charCodeAt(j)))
                            break;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        last = j;
                        for (; j < len; ++j) {
                            if (!isPathSeparator(path.charCodeAt(j)))
                                break;
                        }
                        if (j < len && j !== last) {
                            last = j;
                            for (; j < len; ++j) {
                                if (isPathSeparator(path.charCodeAt(j)))
                                    break;
                            }
                            if (j === len) {
                                device = `\\\\${firstPart}\\${path.slice(last)}`;
                                rootEnd = j;
                            }
                            else if (j !== last) {
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                }
                else {
                    rootEnd = 1;
                }
            }
            else if (isWindowsDeviceRoot(code)) {
                if (path.charCodeAt(1) === CHAR_COLON) {
                    device = path.slice(0, 2);
                    rootEnd = 2;
                    if (len > 2) {
                        if (isPathSeparator(path.charCodeAt(2))) {
                            isAbsolute = true;
                            rootEnd = 3;
                        }
                    }
                }
            }
        }
        else if (isPathSeparator(code)) {
            rootEnd = 1;
            isAbsolute = true;
        }
        if (device.length > 0 &&
            resolvedDevice.length > 0 &&
            device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            continue;
        }
        if (resolvedDevice.length === 0 && device.length > 0) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
            resolvedAbsolute = isAbsolute;
        }
        if (resolvedAbsolute && resolvedDevice.length > 0)
            break;
    }
    resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
    return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
export function normalize(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0)
        return ".";
    let rootEnd = 0;
    let device;
    let isAbsolute = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            isAbsolute = true;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for (; j < len; ++j) {
                    if (isPathSeparator(path.charCodeAt(j)))
                        break;
                }
                if (j < len && j !== last) {
                    const firstPart = path.slice(last, j);
                    last = j;
                    for (; j < len; ++j) {
                        if (!isPathSeparator(path.charCodeAt(j)))
                            break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for (; j < len; ++j) {
                            if (isPathSeparator(path.charCodeAt(j)))
                                break;
                        }
                        if (j === len) {
                            return `\\\\${firstPart}\\${path.slice(last)}\\`;
                        }
                        else if (j !== last) {
                            device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                            rootEnd = j;
                        }
                    }
                }
            }
            else {
                rootEnd = 1;
            }
        }
        else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === CHAR_COLON) {
                device = path.slice(0, 2);
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        isAbsolute = true;
                        rootEnd = 3;
                    }
                }
            }
        }
    }
    else if (isPathSeparator(code)) {
        return "\\";
    }
    let tail;
    if (rootEnd < len) {
        tail = normalizeString(path.slice(rootEnd), !isAbsolute, "\\", isPathSeparator);
    }
    else {
        tail = "";
    }
    if (tail.length === 0 && !isAbsolute)
        tail = ".";
    if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
        tail += "\\";
    }
    if (device === undefined) {
        if (isAbsolute) {
            if (tail.length > 0)
                return `\\${tail}`;
            else
                return "\\";
        }
        else if (tail.length > 0) {
            return tail;
        }
        else {
            return "";
        }
    }
    else if (isAbsolute) {
        if (tail.length > 0)
            return `${device}\\${tail}`;
        else
            return `${device}\\`;
    }
    else if (tail.length > 0) {
        return device + tail;
    }
    else {
        return device;
    }
}
export function isAbsolute(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0)
        return false;
    const code = path.charCodeAt(0);
    if (isPathSeparator(code)) {
        return true;
    }
    else if (isWindowsDeviceRoot(code)) {
        if (len > 2 && path.charCodeAt(1) === CHAR_COLON) {
            if (isPathSeparator(path.charCodeAt(2)))
                return true;
        }
    }
    return false;
}
export function join(...paths) {
    const pathsCount = paths.length;
    if (pathsCount === 0)
        return ".";
    let joined;
    let firstPart = null;
    for (let i = 0; i < pathsCount; ++i) {
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (joined === undefined)
                joined = firstPart = path;
            else
                joined += `\\${path}`;
        }
    }
    if (joined === undefined)
        return ".";
    let needsReplace = true;
    let slashCount = 0;
    assert(firstPart != null);
    if (isPathSeparator(firstPart.charCodeAt(0))) {
        ++slashCount;
        const firstLen = firstPart.length;
        if (firstLen > 1) {
            if (isPathSeparator(firstPart.charCodeAt(1))) {
                ++slashCount;
                if (firstLen > 2) {
                    if (isPathSeparator(firstPart.charCodeAt(2)))
                        ++slashCount;
                    else {
                        needsReplace = false;
                    }
                }
            }
        }
    }
    if (needsReplace) {
        for (; slashCount < joined.length; ++slashCount) {
            if (!isPathSeparator(joined.charCodeAt(slashCount)))
                break;
        }
        if (slashCount >= 2)
            joined = `\\${joined.slice(slashCount)}`;
    }
    return normalize(joined);
}
export function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to)
        return "";
    const fromOrig = resolve(from);
    const toOrig = resolve(to);
    if (fromOrig === toOrig)
        return "";
    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();
    if (from === to)
        return "";
    let fromStart = 0;
    let fromEnd = from.length;
    for (; fromStart < fromEnd; ++fromStart) {
        if (from.charCodeAt(fromStart) !== CHAR_BACKWARD_SLASH)
            break;
    }
    for (; fromEnd - 1 > fromStart; --fromEnd) {
        if (from.charCodeAt(fromEnd - 1) !== CHAR_BACKWARD_SLASH)
            break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 0;
    let toEnd = to.length;
    for (; toStart < toEnd; ++toStart) {
        if (to.charCodeAt(toStart) !== CHAR_BACKWARD_SLASH)
            break;
    }
    for (; toEnd - 1 > toStart; --toEnd) {
        if (to.charCodeAt(toEnd - 1) !== CHAR_BACKWARD_SLASH)
            break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for (; i <= length; ++i) {
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === CHAR_BACKWARD_SLASH) {
                    return toOrig.slice(toStart + i + 1);
                }
                else if (i === 2) {
                    return toOrig.slice(toStart + i);
                }
            }
            if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === CHAR_BACKWARD_SLASH) {
                    lastCommonSep = i;
                }
                else if (i === 2) {
                    lastCommonSep = 3;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode)
            break;
        else if (fromCode === CHAR_BACKWARD_SLASH)
            lastCommonSep = i;
    }
    if (i !== length && lastCommonSep === -1) {
        return toOrig;
    }
    let out = "";
    if (lastCommonSep === -1)
        lastCommonSep = 0;
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
        if (i === fromEnd || from.charCodeAt(i) === CHAR_BACKWARD_SLASH) {
            if (out.length === 0)
                out += "..";
            else
                out += "\\..";
        }
    }
    if (out.length > 0) {
        return out + toOrig.slice(toStart + lastCommonSep, toEnd);
    }
    else {
        toStart += lastCommonSep;
        if (toOrig.charCodeAt(toStart) === CHAR_BACKWARD_SLASH)
            ++toStart;
        return toOrig.slice(toStart, toEnd);
    }
}
export function toNamespacedPath(path) {
    if (typeof path !== "string")
        return path;
    if (path.length === 0)
        return "";
    const resolvedPath = resolve(path);
    if (resolvedPath.length >= 3) {
        if (resolvedPath.charCodeAt(0) === CHAR_BACKWARD_SLASH) {
            if (resolvedPath.charCodeAt(1) === CHAR_BACKWARD_SLASH) {
                const code = resolvedPath.charCodeAt(2);
                if (code !== CHAR_QUESTION_MARK && code !== CHAR_DOT) {
                    return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
                }
            }
        }
        else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0))) {
            if (resolvedPath.charCodeAt(1) === CHAR_COLON &&
                resolvedPath.charCodeAt(2) === CHAR_BACKWARD_SLASH) {
                return `\\\\?\\${resolvedPath}`;
            }
        }
    }
    return path;
}
export function dirname(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0)
        return ".";
    let rootEnd = -1;
    let end = -1;
    let matchedSlash = true;
    let offset = 0;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = offset = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for (; j < len; ++j) {
                    if (isPathSeparator(path.charCodeAt(j)))
                        break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for (; j < len; ++j) {
                        if (!isPathSeparator(path.charCodeAt(j)))
                            break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for (; j < len; ++j) {
                            if (isPathSeparator(path.charCodeAt(j)))
                                break;
                        }
                        if (j === len) {
                            return path;
                        }
                        if (j !== last) {
                            rootEnd = offset = j + 1;
                        }
                    }
                }
            }
        }
        else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === CHAR_COLON) {
                rootEnd = offset = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2)))
                        rootEnd = offset = 3;
                }
            }
        }
    }
    else if (isPathSeparator(code)) {
        return path;
    }
    for (let i = len - 1; i >= offset; --i) {
        if (isPathSeparator(path.charCodeAt(i))) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        }
        else {
            matchedSlash = false;
        }
    }
    if (end === -1) {
        if (rootEnd === -1)
            return ".";
        else
            end = rootEnd;
    }
    return path.slice(0, end);
}
export function basename(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if (isWindowsDeviceRoot(drive)) {
            if (path.charCodeAt(1) === CHAR_COLON)
                start = 2;
        }
    }
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path)
            return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for (i = path.length - 1; i >= start; --i) {
            const code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            }
            else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    }
                    else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end)
            end = firstNonSlashEnd;
        else if (end === -1)
            end = path.length;
        return path.slice(start, end);
    }
    else {
        for (i = path.length - 1; i >= start; --i) {
            if (isPathSeparator(path.charCodeAt(i))) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            }
            else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1)
            return "";
        return path.slice(start, end);
    }
}
export function extname(path) {
    assertPath(path);
    let start = 0;
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    if (path.length >= 2 &&
        path.charCodeAt(1) === CHAR_COLON &&
        isWindowsDeviceRoot(path.charCodeAt(0))) {
        start = startPart = 2;
    }
    for (let i = path.length - 1; i >= start; --i) {
        const code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === CHAR_DOT) {
            if (startDot === -1)
                startDot = i;
            else if (preDotState !== 1)
                preDotState = 1;
        }
        else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 ||
        end === -1 ||
        preDotState === 0 ||
        (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)) {
        return "";
    }
    return path.slice(startDot, end);
}
export function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("\\", pathObject);
}
export function parse(path) {
    assertPath(path);
    const ret = { root: "", dir: "", base: "", ext: "", name: "" };
    const len = path.length;
    if (len === 0)
        return ret;
    let rootEnd = 0;
    let code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for (; j < len; ++j) {
                    if (isPathSeparator(path.charCodeAt(j)))
                        break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for (; j < len; ++j) {
                        if (!isPathSeparator(path.charCodeAt(j)))
                            break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for (; j < len; ++j) {
                            if (isPathSeparator(path.charCodeAt(j)))
                                break;
                        }
                        if (j === len) {
                            rootEnd = j;
                        }
                        else if (j !== last) {
                            rootEnd = j + 1;
                        }
                    }
                }
            }
        }
        else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === CHAR_COLON) {
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        if (len === 3) {
                            ret.root = ret.dir = path;
                            return ret;
                        }
                        rootEnd = 3;
                    }
                }
                else {
                    ret.root = ret.dir = path;
                    return ret;
                }
            }
        }
    }
    else if (isPathSeparator(code)) {
        ret.root = ret.dir = path;
        return ret;
    }
    if (rootEnd > 0)
        ret.root = path.slice(0, rootEnd);
    let startDot = -1;
    let startPart = rootEnd;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for (; i >= rootEnd; --i) {
        code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === CHAR_DOT) {
            if (startDot === -1)
                startDot = i;
            else if (preDotState !== 1)
                preDotState = 1;
        }
        else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 ||
        end === -1 ||
        preDotState === 0 ||
        (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)) {
        if (end !== -1) {
            ret.base = ret.name = path.slice(startPart, end);
        }
    }
    else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0 && startPart !== rootEnd) {
        ret.dir = path.slice(0, startPart - 1);
    }
    else
        ret.dir = ret.root;
    return ret;
}
export function fromFileUrl(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
    if (url.hostname != "") {
        path = `\\\\${url.hostname}${path}`;
    }
    return path;
}
export function toFileUrl(path) {
    if (!isAbsolute(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const [, hostname, pathname] = path.match(/^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/);
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
    if (hostname != null && hostname != "localhost") {
        url.hostname = hostname;
        if (!url.hostname) {
            throw new TypeError("Invalid hostname.");
        }
    }
    return url;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luMzIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3aW4zMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFNQSxPQUFPLEVBQ0wsbUJBQW1CLEVBQ25CLFVBQVUsRUFDVixRQUFRLEVBQ1Isa0JBQWtCLEdBQ25CLE1BQU0saUJBQWlCLENBQUM7QUFFekIsT0FBTyxFQUNMLE9BQU8sRUFDUCxVQUFVLEVBQ1YsZ0JBQWdCLEVBQ2hCLGVBQWUsRUFDZixtQkFBbUIsRUFDbkIsZUFBZSxHQUNoQixNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFNUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQztBQUN4QixNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBTTdCLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxZQUFzQjtJQUMvQyxJQUFJLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDeEIsSUFBSSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLElBQUksZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO0lBRTdCLEtBQUssSUFBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ2xELElBQUksSUFBWSxDQUFDO1FBRWpCLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxVQUFpQixDQUFDO1FBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNWLElBQUksR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDeEI7YUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQzFCLElBQUksT0FBTyxJQUFJLEVBQUUsR0FBRyxLQUFLLFVBQVUsRUFBRTtnQkFDbkMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO2FBQ3pFO1lBQ0QsSUFBSSxHQUFHLElB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QUM7S0FDbEQ7SUFDRCxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FDdkMsa0RBQWtELENBQ2xELENBQUM7SUFDSCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoQyxHQUFHLENBQUMsUUFBUSxHQUFHLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDL0QsSUFBSSxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsSUFBSSxXQUFXLEVBQUU7UUFDL0MsR0FBRyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDeEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDakIsTUFBTSxJQUFJLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1NBQzFDO0tBQ0Y7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IHRoZSBCcm93c2VyaWZ5IGF1dGhvcnMuIE1JVCBMaWNlbnNlLlxuLy8gUG9ydGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2Jyb3dzZXJpZnkvcGF0aC1icm93c2VyaWZ5L1xuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQgdHlwZSB7IEZvcm1hdElucHV0UGF0aE9iamVjdCwgUGFyc2VkUGF0aCB9IGZyb20gXCIuL19pbnRlcmZhY2UudHNcIjtcbmltcG9ydCB7XG4gIENIQVJfQkFDS1dBUkRfU0xBU0gsXG4gIENIQVJfQ09MT04sXG4gIENIQVJfRE9ULFxuICBDSEFSX1FVRVNUSU9OX01BUkssXG59IGZyb20gXCIuL19jb25zdGFudHMudHNcIjtcblxuaW1wb3J0IHtcbiAgX2Zvcm1hdCxcbiAgYXNzZXJ0UGF0aCxcbiAgZW5jb2RlV2hpdGVzcGFjZSxcbiAgaXNQYXRoU2VwYXJhdG9yLFxuICBpc1dpbmRvd3NEZXZpY2VSb290LFxuICBub3JtYWxpemVTdHJpbmcsXG59IGZyb20gXCIuL191dGlsLnRzXCI7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5cbmV4cG9ydCBjb25zdCBzZXAgPSBcIlxcXFxcIjtcbmV4cG9ydCBjb25zdCBkZWxpbWl0ZXIgPSBcIjtcIjtcblxuLyoqXG4gKiBSZXNvbHZlcyBwYXRoIHNlZ21lbnRzIGludG8gYSBgcGF0aGBcbiAqIEBwYXJhbSBwYXRoU2VnbWVudHMgdG8gcHJvY2VzcyB0byBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKC4uLnBhdGhTZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBsZXQgcmVzb2x2ZWREZXZpY2UgPSBcIlwiO1xuICBsZXQgcmVzb2x2ZWRUYWlsID0gXCJcIjtcbiAgbGV0IHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gcGF0aFNlZ21lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTE7IGktLSkge1xuICAgIGxldCBwYXRoOiBzdHJpbmc7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCB7IERlbm8gfSA9IGdsb2JhbFRoaXMgYXMgYW55O1xuICAgIGlmIChpID49IDApIHtcbiAgICAgIHBhdGggPSBwYXRoU2VnbWVudHNbaV07XG4gICAgfSBlbHNlIGlmICghcmVzb2x2ZWREZXZpY2UpIHtcbiAgICAgIGlmICh0eXBlb2YgRGVubz8uY3dkICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlJlc29sdmVkIGEgZHJpdmUtbGV0dGVyLWxlc3MgcGF0aCB3aXRob3V0IGEgQ1dELlwiKTtcbiAgICAgIH1cbiAgICAgIHBhdGggPSBEZW5vLmN3ZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXG4gICAgICAgIHR5cGVvZiBEZW5vPy5lbnY/LmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiBEZW5vPy5jd2QgIT09IFwiZnVuY3Rpb25cIlxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJSZXNvbHZlZCBhIHJlbGF0aXZlIHBhdGggd2l0aG91dCBhIENXRC5cIik7XG4gICAgICB9XG4gICAgICBwYXRoID0gRGVuby5jd2QoKTtcblxuICAgICAgLy8gVmVyaWZ5IHRoYXQgYSBjd2Qgd2FzIGZvdW5kIGFuZCB0aGF0IGl0IGFjdHVhbGx5IHBvaW50c1xuICAgICAgLy8gdG8gb3VyIGRyaXZlLiBJZiBub3QsIGRlZmF1bHQgdG8gdGhlIGRyaXZlJ3Mgcm9vdC5cbiAgICAgIGlmIChcbiAgICAgICAgcGF0aCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIHBhdGguc2xpY2UoMCwgMykudG9Mb3dlckNhc2UoKSAhPT0gYCR7cmVzb2x2ZWREZXZpY2UudG9Mb3dlckNhc2UoKX1cXFxcYFxuICAgICAgKSB7XG4gICAgICAgIHBhdGggPSBgJHtyZXNvbHZlZERldmljZX1cXFxcYDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgY29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG5cbiAgICAvLyBTa2lwIGVtcHR5IGVudHJpZXNcbiAgICBpZiAobGVuID09PSAwKSBjb250aW51ZTtcblxuICAgIGxldCByb290RW5kID0gMDtcbiAgICBsZXQgZGV2aWNlID0gXCJcIjtcbiAgICBsZXQgaXNBYnNvbHV0ZSA9IGZhbHNlO1xuICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgICAvLyBUcnkgdG8gbWF0Y2ggYSByb290XG4gICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgICAgLy8gUG9zc2libGUgVU5DIHJvb3RcblxuICAgICAgICAvLyBJZiB3ZSBzdGFydGVkIHdpdGggYSBzZXBhcmF0b3IsIHdlIGtub3cgd2UgYXQgbGVhc3QgaGF2ZSBhblxuICAgICAgICAvLyBhYnNvbHV0ZSBwYXRoIG9mIHNvbWUga2luZCAoVU5DIG9yIG90aGVyd2lzZSlcbiAgICAgICAgaXNBYnNvbHV0ZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMSkpKSB7XG4gICAgICAgICAgLy8gTWF0Y2hlZCBkb3VibGUgcGF0aCBzZXBhcmF0b3IgYXQgYmVnaW5uaW5nXG4gICAgICAgICAgbGV0IGogPSAyO1xuICAgICAgICAgIGxldCBsYXN0ID0gajtcbiAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0UGFydCA9IHBhdGguc2xpY2UobGFzdCwgaik7XG4gICAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgICAgbGFzdCA9IGo7XG4gICAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICAgIGlmICghaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuICAgICAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgICAgICBsYXN0ID0gajtcbiAgICAgICAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICAgICAgZm9yICg7IGogPCBsZW47ICsraikge1xuICAgICAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGogPT09IGxlbikge1xuICAgICAgICAgICAgICAgIC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCBvbmx5XG4gICAgICAgICAgICAgICAgZGV2aWNlID0gYFxcXFxcXFxcJHtmaXJzdFBhcnR9XFxcXCR7cGF0aC5zbGljZShsYXN0KX1gO1xuICAgICAgICAgICAgICAgIHJvb3RFbmQgPSBqO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIGEgVU5DIHJvb3Qgd2l0aCBsZWZ0b3ZlcnNcblxuICAgICAgICAgICAgICAgIGRldmljZSA9IGBcXFxcXFxcXCR7Zmlyc3RQYXJ0fVxcXFwke3BhdGguc2xpY2UobGFzdCwgail9YDtcbiAgICAgICAgICAgICAgICByb290RW5kID0gajtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByb290RW5kID0gMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc1dpbmRvd3NEZXZpY2VSb290KGNvZGUpKSB7XG4gICAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgICAgaWYgKHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikge1xuICAgICAgICAgIGRldmljZSA9IHBhdGguc2xpY2UoMCwgMik7XG4gICAgICAgICAgcm9vdEVuZCA9IDI7XG4gICAgICAgICAgaWYgKGxlbiA+IDIpIHtcbiAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDIpKSkge1xuICAgICAgICAgICAgICAvLyBUcmVhdCBzZXBhcmF0b3IgZm9sbG93aW5nIGRyaXZlIG5hbWUgYXMgYW4gYWJzb2x1dGUgcGF0aFxuICAgICAgICAgICAgICAvLyBpbmRpY2F0b3JcbiAgICAgICAgICAgICAgaXNBYnNvbHV0ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHJvb3RFbmQgPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIHBhdGggc2VwYXJhdG9yXG4gICAgICByb290RW5kID0gMTtcbiAgICAgIGlzQWJzb2x1dGUgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIGRldmljZS5sZW5ndGggPiAwICYmXG4gICAgICByZXNvbHZlZERldmljZS5sZW5ndGggPiAwICYmXG4gICAgICBkZXZpY2UudG9Mb3dlckNhc2UoKSAhPT0gcmVzb2x2ZWREZXZpY2UudG9Mb3dlckNhc2UoKVxuICAgICkge1xuICAgICAgLy8gVGhpcyBwYXRoIHBvaW50cyB0byBhbm90aGVyIGRldmljZSBzbyBpdCBpcyBub3QgYXBwbGljYWJsZVxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHJlc29sdmVkRGV2aWNlLmxlbmd0aCA9PT0gMCAmJiBkZXZpY2UubGVuZ3RoID4gMCkge1xuICAgICAgcmVzb2x2ZWREZXZpY2UgPSBkZXZpY2U7XG4gICAgfVxuICAgIGlmICghcmVzb2x2ZWRBYnNvbHV0ZSkge1xuICAgICAgcmVzb2x2ZWRUYWlsID0gYCR7cGF0aC5zbGljZShyb290RW5kKX1cXFxcJHtyZXNvbHZlZFRhaWx9YDtcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBpc0Fic29sdXRlO1xuICAgIH1cblxuICAgIGlmIChyZXNvbHZlZEFic29sdXRlICYmIHJlc29sdmVkRGV2aWNlLmxlbmd0aCA+IDApIGJyZWFrO1xuICB9XG5cbiAgLy8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsXG4gIC8vIGJ1dCBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKVxuICAvLyBmYWlscylcblxuICAvLyBOb3JtYWxpemUgdGhlIHRhaWwgcGF0aFxuICByZXNvbHZlZFRhaWwgPSBub3JtYWxpemVTdHJpbmcoXG4gICAgcmVzb2x2ZWRUYWlsLFxuICAgICFyZXNvbHZlZEFic29sdXRlLFxuICAgIFwiXFxcXFwiLFxuICAgIGlzUGF0aFNlcGFyYXRvcixcbiAgKTtcblxuICByZXR1cm4gcmVzb2x2ZWREZXZpY2UgKyAocmVzb2x2ZWRBYnNvbHV0ZSA/IFwiXFxcXFwiIDogXCJcIikgKyByZXNvbHZlZFRhaWwgfHwgXCIuXCI7XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIGBwYXRoYFxuICogQHBhcmFtIHBhdGggdG8gbm9ybWFsaXplXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgY29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG4gIGlmIChsZW4gPT09IDApIHJldHVybiBcIi5cIjtcbiAgbGV0IHJvb3RFbmQgPSAwO1xuICBsZXQgZGV2aWNlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGxldCBpc0Fic29sdXRlID0gZmFsc2U7XG4gIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgLy8gVHJ5IHRvIG1hdGNoIGEgcm9vdFxuICBpZiAobGVuID4gMSkge1xuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIFVOQyByb290XG5cbiAgICAgIC8vIElmIHdlIHN0YXJ0ZWQgd2l0aCBhIHNlcGFyYXRvciwgd2Uga25vdyB3ZSBhdCBsZWFzdCBoYXZlIGFuIGFic29sdXRlXG4gICAgICAvLyBwYXRoIG9mIHNvbWUga2luZCAoVU5DIG9yIG90aGVyd2lzZSlcbiAgICAgIGlzQWJzb2x1dGUgPSB0cnVlO1xuXG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgxKSkpIHtcbiAgICAgICAgLy8gTWF0Y2hlZCBkb3VibGUgcGF0aCBzZXBhcmF0b3IgYXQgYmVnaW5uaW5nXG4gICAgICAgIGxldCBqID0gMjtcbiAgICAgICAgbGV0IGxhc3QgPSBqO1xuICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG4gICAgICAgICAgY29uc3QgZmlyc3RQYXJ0ID0gcGF0aC5zbGljZShsYXN0LCBqKTtcbiAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgIGxhc3QgPSBqO1xuICAgICAgICAgIC8vIE1hdGNoIDEgb3IgbW9yZSBwYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICBpZiAoIWlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuICAgICAgICAgICAgLy8gTWF0Y2hlZCFcbiAgICAgICAgICAgIGxhc3QgPSBqO1xuICAgICAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChqID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IG9ubHlcbiAgICAgICAgICAgICAgLy8gUmV0dXJuIHRoZSBub3JtYWxpemVkIHZlcnNpb24gb2YgdGhlIFVOQyByb290IHNpbmNlIHRoZXJlXG4gICAgICAgICAgICAgIC8vIGlzIG5vdGhpbmcgbGVmdCB0byBwcm9jZXNzXG5cbiAgICAgICAgICAgICAgcmV0dXJuIGBcXFxcXFxcXCR7Zmlyc3RQYXJ0fVxcXFwke3BhdGguc2xpY2UobGFzdCl9XFxcXGA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IHdpdGggbGVmdG92ZXJzXG5cbiAgICAgICAgICAgICAgZGV2aWNlID0gYFxcXFxcXFxcJHtmaXJzdFBhcnR9XFxcXCR7cGF0aC5zbGljZShsYXN0LCBqKX1gO1xuICAgICAgICAgICAgICByb290RW5kID0gajtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJvb3RFbmQgPSAxO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaW5kb3dzRGV2aWNlUm9vdChjb2RlKSkge1xuICAgICAgLy8gUG9zc2libGUgZGV2aWNlIHJvb3RcblxuICAgICAgaWYgKHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikge1xuICAgICAgICBkZXZpY2UgPSBwYXRoLnNsaWNlKDAsIDIpO1xuICAgICAgICByb290RW5kID0gMjtcbiAgICAgICAgaWYgKGxlbiA+IDIpIHtcbiAgICAgICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgyKSkpIHtcbiAgICAgICAgICAgIC8vIFRyZWF0IHNlcGFyYXRvciBmb2xsb3dpbmcgZHJpdmUgbmFtZSBhcyBhbiBhYnNvbHV0ZSBwYXRoXG4gICAgICAgICAgICAvLyBpbmRpY2F0b3JcbiAgICAgICAgICAgIGlzQWJzb2x1dGUgPSB0cnVlO1xuICAgICAgICAgICAgcm9vdEVuZCA9IDM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuICAgIC8vIGBwYXRoYCBjb250YWlucyBqdXN0IGEgcGF0aCBzZXBhcmF0b3IsIGV4aXQgZWFybHkgdG8gYXZvaWQgdW5uZWNlc3NhcnlcbiAgICAvLyB3b3JrXG4gICAgcmV0dXJuIFwiXFxcXFwiO1xuICB9XG5cbiAgbGV0IHRhaWw6IHN0cmluZztcbiAgaWYgKHJvb3RFbmQgPCBsZW4pIHtcbiAgICB0YWlsID0gbm9ybWFsaXplU3RyaW5nKFxuICAgICAgcGF0aC5zbGljZShyb290RW5kKSxcbiAgICAgICFpc0Fic29sdXRlLFxuICAgICAgXCJcXFxcXCIsXG4gICAgICBpc1BhdGhTZXBhcmF0b3IsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICB0YWlsID0gXCJcIjtcbiAgfVxuICBpZiAodGFpbC5sZW5ndGggPT09IDAgJiYgIWlzQWJzb2x1dGUpIHRhaWwgPSBcIi5cIjtcbiAgaWYgKHRhaWwubGVuZ3RoID4gMCAmJiBpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGxlbiAtIDEpKSkge1xuICAgIHRhaWwgKz0gXCJcXFxcXCI7XG4gIH1cbiAgaWYgKGRldmljZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGlzQWJzb2x1dGUpIHtcbiAgICAgIGlmICh0YWlsLmxlbmd0aCA+IDApIHJldHVybiBgXFxcXCR7dGFpbH1gO1xuICAgICAgZWxzZSByZXR1cm4gXCJcXFxcXCI7XG4gICAgfSBlbHNlIGlmICh0YWlsLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0YWlsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNBYnNvbHV0ZSkge1xuICAgIGlmICh0YWlsLmxlbmd0aCA+IDApIHJldHVybiBgJHtkZXZpY2V9XFxcXCR7dGFpbH1gO1xuICAgIGVsc2UgcmV0dXJuIGAke2RldmljZX1cXFxcYDtcbiAgfSBlbHNlIGlmICh0YWlsLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gZGV2aWNlICsgdGFpbDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGV2aWNlO1xuICB9XG59XG5cbi8qKlxuICogVmVyaWZpZXMgd2hldGhlciBwYXRoIGlzIGFic29sdXRlXG4gKiBAcGFyYW0gcGF0aCB0byB2ZXJpZnlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQWJzb2x1dGUocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG4gIGNvbnN0IGxlbiA9IHBhdGgubGVuZ3RoO1xuICBpZiAobGVuID09PSAwKSByZXR1cm4gZmFsc2U7XG5cbiAgY29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdCgwKTtcbiAgaWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkpIHtcbiAgICAvLyBQb3NzaWJsZSBkZXZpY2Ugcm9vdFxuXG4gICAgaWYgKGxlbiA+IDIgJiYgcGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OKSB7XG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgyKSkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogSm9pbiBhbGwgZ2l2ZW4gYSBzZXF1ZW5jZSBvZiBgcGF0aHNgLHRoZW4gbm9ybWFsaXplcyB0aGUgcmVzdWx0aW5nIHBhdGguXG4gKiBAcGFyYW0gcGF0aHMgdG8gYmUgam9pbmVkIGFuZCBub3JtYWxpemVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBqb2luKC4uLnBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGNvbnN0IHBhdGhzQ291bnQgPSBwYXRocy5sZW5ndGg7XG4gIGlmIChwYXRoc0NvdW50ID09PSAwKSByZXR1cm4gXCIuXCI7XG5cbiAgbGV0IGpvaW5lZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBsZXQgZmlyc3RQYXJ0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoc0NvdW50OyArK2kpIHtcbiAgICBjb25zdCBwYXRoID0gcGF0aHNbaV07XG4gICAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgICBpZiAocGF0aC5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoam9pbmVkID09PSB1bmRlZmluZWQpIGpvaW5lZCA9IGZpcnN0UGFydCA9IHBhdGg7XG4gICAgICBlbHNlIGpvaW5lZCArPSBgXFxcXCR7cGF0aH1gO1xuICAgIH1cbiAgfVxuXG4gIGlmIChqb2luZWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIFwiLlwiO1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBqb2luZWQgcGF0aCBkb2Vzbid0IHN0YXJ0IHdpdGggdHdvIHNsYXNoZXMsIGJlY2F1c2VcbiAgLy8gbm9ybWFsaXplKCkgd2lsbCBtaXN0YWtlIGl0IGZvciBhbiBVTkMgcGF0aCB0aGVuLlxuICAvL1xuICAvLyBUaGlzIHN0ZXAgaXMgc2tpcHBlZCB3aGVuIGl0IGlzIHZlcnkgY2xlYXIgdGhhdCB0aGUgdXNlciBhY3R1YWxseVxuICAvLyBpbnRlbmRlZCB0byBwb2ludCBhdCBhbiBVTkMgcGF0aC4gVGhpcyBpcyBhc3N1bWVkIHdoZW4gdGhlIGZpcnN0XG4gIC8vIG5vbi1lbXB0eSBzdHJpbmcgYXJndW1lbnRzIHN0YXJ0cyB3aXRoIGV4YWN0bHkgdHdvIHNsYXNoZXMgZm9sbG93ZWQgYnlcbiAgLy8gYXQgbGVhc3Qgb25lIG1vcmUgbm9uLXNsYXNoIGNoYXJhY3Rlci5cbiAgLy9cbiAgLy8gTm90ZSB0aGF0IGZvciBub3JtYWxpemUoKSB0byB0cmVhdCBhIHBhdGggYXMgYW4gVU5DIHBhdGggaXQgbmVlZHMgdG9cbiAgLy8gaGF2ZSBhdCBsZWFzdCAyIGNvbXBvbmVudHMsIHNvIHdlIGRvbid0IGZpbHRlciBmb3IgdGhhdCBoZXJlLlxuICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlIHVzZXIgY2FuIHVzZSBqb2luIHRvIGNvbnN0cnVjdCBVTkMgcGF0aHMgZnJvbVxuICAvLyBhIHNlcnZlciBuYW1lIGFuZCBhIHNoYXJlIG5hbWU7IGZvciBleGFtcGxlOlxuICAvLyAgIHBhdGguam9pbignLy9zZXJ2ZXInLCAnc2hhcmUnKSAtPiAnXFxcXFxcXFxzZXJ2ZXJcXFxcc2hhcmVcXFxcJylcbiAgbGV0IG5lZWRzUmVwbGFjZSA9IHRydWU7XG4gIGxldCBzbGFzaENvdW50ID0gMDtcbiAgYXNzZXJ0KGZpcnN0UGFydCAhPSBudWxsKTtcbiAgaWYgKGlzUGF0aFNlcGFyYXRvcihmaXJzdFBhcnQuY2hhckNvZGVBdCgwKSkpIHtcbiAgICArK3NsYXNoQ291bnQ7XG4gICAgY29uc3QgZmlyc3RMZW4gPSBmaXJzdFBhcnQubGVuZ3RoO1xuICAgIGlmIChmaXJzdExlbiA+IDEpIHtcbiAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoZmlyc3RQYXJ0LmNoYXJDb2RlQXQoMSkpKSB7XG4gICAgICAgICsrc2xhc2hDb3VudDtcbiAgICAgICAgaWYgKGZpcnN0TGVuID4gMikge1xuICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoZmlyc3RQYXJ0LmNoYXJDb2RlQXQoMikpKSArK3NsYXNoQ291bnQ7XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBXZSBtYXRjaGVkIGEgVU5DIHBhdGggaW4gdGhlIGZpcnN0IHBhcnRcbiAgICAgICAgICAgIG5lZWRzUmVwbGFjZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAobmVlZHNSZXBsYWNlKSB7XG4gICAgLy8gRmluZCBhbnkgbW9yZSBjb25zZWN1dGl2ZSBzbGFzaGVzIHdlIG5lZWQgdG8gcmVwbGFjZVxuICAgIGZvciAoOyBzbGFzaENvdW50IDwgam9pbmVkLmxlbmd0aDsgKytzbGFzaENvdW50KSB7XG4gICAgICBpZiAoIWlzUGF0aFNlcGFyYXRvcihqb2luZWQuY2hhckNvZGVBdChzbGFzaENvdW50KSkpIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFJlcGxhY2UgdGhlIHNsYXNoZXMgaWYgbmVlZGVkXG4gICAgaWYgKHNsYXNoQ291bnQgPj0gMikgam9pbmVkID0gYFxcXFwke2pvaW5lZC5zbGljZShzbGFzaENvdW50KX1gO1xuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZShqb2luZWQpO1xufVxuXG4vKipcbiAqIEl0IHdpbGwgc29sdmUgdGhlIHJlbGF0aXZlIHBhdGggZnJvbSBgZnJvbWAgdG8gYHRvYCwgZm9yIGluc3RhbmNlOlxuICogIGZyb20gPSAnQzpcXFxcb3JhbmRlYVxcXFx0ZXN0XFxcXGFhYSdcbiAqICB0byA9ICdDOlxcXFxvcmFuZGVhXFxcXGltcGxcXFxcYmJiJ1xuICogVGhlIG91dHB1dCBvZiB0aGUgZnVuY3Rpb24gc2hvdWxkIGJlOiAnLi5cXFxcLi5cXFxcaW1wbFxcXFxiYmInXG4gKiBAcGFyYW0gZnJvbSByZWxhdGl2ZSBwYXRoXG4gKiBAcGFyYW0gdG8gcmVsYXRpdmUgcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChmcm9tKTtcbiAgYXNzZXJ0UGF0aCh0byk7XG5cbiAgaWYgKGZyb20gPT09IHRvKSByZXR1cm4gXCJcIjtcblxuICBjb25zdCBmcm9tT3JpZyA9IHJlc29sdmUoZnJvbSk7XG4gIGNvbnN0IHRvT3JpZyA9IHJlc29sdmUodG8pO1xuXG4gIGlmIChmcm9tT3JpZyA9PT0gdG9PcmlnKSByZXR1cm4gXCJcIjtcblxuICBmcm9tID0gZnJvbU9yaWcudG9Mb3dlckNhc2UoKTtcbiAgdG8gPSB0b09yaWcudG9Mb3dlckNhc2UoKTtcblxuICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiBcIlwiO1xuXG4gIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgbGV0IGZyb21TdGFydCA9IDA7XG4gIGxldCBmcm9tRW5kID0gZnJvbS5sZW5ndGg7XG4gIGZvciAoOyBmcm9tU3RhcnQgPCBmcm9tRW5kOyArK2Zyb21TdGFydCkge1xuICAgIGlmIChmcm9tLmNoYXJDb2RlQXQoZnJvbVN0YXJ0KSAhPT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgLy8gVHJpbSB0cmFpbGluZyBiYWNrc2xhc2hlcyAoYXBwbGljYWJsZSB0byBVTkMgcGF0aHMgb25seSlcbiAgZm9yICg7IGZyb21FbmQgLSAxID4gZnJvbVN0YXJ0OyAtLWZyb21FbmQpIHtcbiAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21FbmQgLSAxKSAhPT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgY29uc3QgZnJvbUxlbiA9IGZyb21FbmQgLSBmcm9tU3RhcnQ7XG5cbiAgLy8gVHJpbSBhbnkgbGVhZGluZyBiYWNrc2xhc2hlc1xuICBsZXQgdG9TdGFydCA9IDA7XG4gIGxldCB0b0VuZCA9IHRvLmxlbmd0aDtcbiAgZm9yICg7IHRvU3RhcnQgPCB0b0VuZDsgKyt0b1N0YXJ0KSB7XG4gICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCkgIT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIGJyZWFrO1xuICB9XG4gIC8vIFRyaW0gdHJhaWxpbmcgYmFja3NsYXNoZXMgKGFwcGxpY2FibGUgdG8gVU5DIHBhdGhzIG9ubHkpXG4gIGZvciAoOyB0b0VuZCAtIDEgPiB0b1N0YXJ0OyAtLXRvRW5kKSB7XG4gICAgaWYgKHRvLmNoYXJDb2RlQXQodG9FbmQgLSAxKSAhPT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgY29uc3QgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cbiAgLy8gQ29tcGFyZSBwYXRocyB0byBmaW5kIHRoZSBsb25nZXN0IGNvbW1vbiBwYXRoIGZyb20gcm9vdFxuICBjb25zdCBsZW5ndGggPSBmcm9tTGVuIDwgdG9MZW4gPyBmcm9tTGVuIDogdG9MZW47XG4gIGxldCBsYXN0Q29tbW9uU2VwID0gLTE7XG4gIGxldCBpID0gMDtcbiAgZm9yICg7IGkgPD0gbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoaSA9PT0gbGVuZ3RoKSB7XG4gICAgICBpZiAodG9MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCArIGkpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG4gICAgICAgICAgLy8gV2UgZ2V0IGhlcmUgaWYgYGZyb21gIGlzIHRoZSBleGFjdCBiYXNlIHBhdGggZm9yIGB0b2AuXG4gICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209J0M6XFxcXGZvb1xcXFxiYXInOyB0bz0nQzpcXFxcZm9vXFxcXGJhclxcXFxiYXonXG4gICAgICAgICAgcmV0dXJuIHRvT3JpZy5zbGljZSh0b1N0YXJ0ICsgaSArIDEpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDIpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGRldmljZSByb290LlxuICAgICAgICAgIC8vIEZvciBleGFtcGxlOiBmcm9tPSdDOlxcXFwnOyB0bz0nQzpcXFxcZm9vJ1xuICAgICAgICAgIHJldHVybiB0b09yaWcuc2xpY2UodG9TdGFydCArIGkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZnJvbUxlbiA+IGxlbmd0aCkge1xuICAgICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG4gICAgICAgICAgLy8gV2UgZ2V0IGhlcmUgaWYgYHRvYCBpcyB0aGUgZXhhY3QgYmFzZSBwYXRoIGZvciBgZnJvbWAuXG4gICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209J0M6XFxcXGZvb1xcXFxiYXInOyB0bz0nQzpcXFxcZm9vJ1xuICAgICAgICAgIGxhc3RDb21tb25TZXAgPSBpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDIpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSBkZXZpY2Ugcm9vdC5cbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nQzpcXFxcZm9vXFxcXGJhcic7IHRvPSdDOlxcXFwnXG4gICAgICAgICAgbGFzdENvbW1vblNlcCA9IDM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBmcm9tQ29kZSA9IGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQgKyBpKTtcbiAgICBjb25zdCB0b0NvZGUgPSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKTtcbiAgICBpZiAoZnJvbUNvZGUgIT09IHRvQ29kZSkgYnJlYWs7XG4gICAgZWxzZSBpZiAoZnJvbUNvZGUgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIGxhc3RDb21tb25TZXAgPSBpO1xuICB9XG5cbiAgLy8gV2UgZm91bmQgYSBtaXNtYXRjaCBiZWZvcmUgdGhlIGZpcnN0IGNvbW1vbiBwYXRoIHNlcGFyYXRvciB3YXMgc2Vlbiwgc29cbiAgLy8gcmV0dXJuIHRoZSBvcmlnaW5hbCBgdG9gLlxuICBpZiAoaSAhPT0gbGVuZ3RoICYmIGxhc3RDb21tb25TZXAgPT09IC0xKSB7XG4gICAgcmV0dXJuIHRvT3JpZztcbiAgfVxuXG4gIGxldCBvdXQgPSBcIlwiO1xuICBpZiAobGFzdENvbW1vblNlcCA9PT0gLTEpIGxhc3RDb21tb25TZXAgPSAwO1xuICAvLyBHZW5lcmF0ZSB0aGUgcmVsYXRpdmUgcGF0aCBiYXNlZCBvbiB0aGUgcGF0aCBkaWZmZXJlbmNlIGJldHdlZW4gYHRvYCBhbmRcbiAgLy8gYGZyb21gXG4gIGZvciAoaSA9IGZyb21TdGFydCArIGxhc3RDb21tb25TZXAgKyAxOyBpIDw9IGZyb21FbmQ7ICsraSkge1xuICAgIGlmIChpID09PSBmcm9tRW5kIHx8IGZyb20uY2hhckNvZGVBdChpKSA9PT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkge1xuICAgICAgaWYgKG91dC5sZW5ndGggPT09IDApIG91dCArPSBcIi4uXCI7XG4gICAgICBlbHNlIG91dCArPSBcIlxcXFwuLlwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIExhc3RseSwgYXBwZW5kIHRoZSByZXN0IG9mIHRoZSBkZXN0aW5hdGlvbiAoYHRvYCkgcGF0aCB0aGF0IGNvbWVzIGFmdGVyXG4gIC8vIHRoZSBjb21tb24gcGF0aCBwYXJ0c1xuICBpZiAob3V0Lmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gb3V0ICsgdG9PcmlnLnNsaWNlKHRvU3RhcnQgKyBsYXN0Q29tbW9uU2VwLCB0b0VuZCk7XG4gIH0gZWxzZSB7XG4gICAgdG9TdGFydCArPSBsYXN0Q29tbW9uU2VwO1xuICAgIGlmICh0b09yaWcuY2hhckNvZGVBdCh0b1N0YXJ0KSA9PT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgKyt0b1N0YXJ0O1xuICAgIHJldHVybiB0b09yaWcuc2xpY2UodG9TdGFydCwgdG9FbmQpO1xuICB9XG59XG5cbi8qKlxuICogUmVzb2x2ZXMgcGF0aCB0byBhIG5hbWVzcGFjZSBwYXRoXG4gKiBAcGFyYW0gcGF0aCB0byByZXNvbHZlIHRvIG5hbWVzcGFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9OYW1lc3BhY2VkUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOb3RlOiB0aGlzIHdpbGwgKnByb2JhYmx5KiB0aHJvdyBzb21ld2hlcmUuXG4gIGlmICh0eXBlb2YgcGF0aCAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIHBhdGg7XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiXCI7XG5cbiAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcmVzb2x2ZShwYXRoKTtcblxuICBpZiAocmVzb2x2ZWRQYXRoLmxlbmd0aCA+PSAzKSB7XG4gICAgaWYgKHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG4gICAgICAvLyBQb3NzaWJsZSBVTkMgcm9vdFxuXG4gICAgICBpZiAocmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcbiAgICAgICAgY29uc3QgY29kZSA9IHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDIpO1xuICAgICAgICBpZiAoY29kZSAhPT0gQ0hBUl9RVUVTVElPTl9NQVJLICYmIGNvZGUgIT09IENIQVJfRE9UKSB7XG4gICAgICAgICAgLy8gTWF0Y2hlZCBub24tbG9uZyBVTkMgcm9vdCwgY29udmVydCB0aGUgcGF0aCB0byBhIGxvbmcgVU5DIHBhdGhcbiAgICAgICAgICByZXR1cm4gYFxcXFxcXFxcP1xcXFxVTkNcXFxcJHtyZXNvbHZlZFBhdGguc2xpY2UoMil9YDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaW5kb3dzRGV2aWNlUm9vdChyZXNvbHZlZFBhdGguY2hhckNvZGVBdCgwKSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgIGlmIChcbiAgICAgICAgcmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04gJiZcbiAgICAgICAgcmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMikgPT09IENIQVJfQkFDS1dBUkRfU0xBU0hcbiAgICAgICkge1xuICAgICAgICAvLyBNYXRjaGVkIGRldmljZSByb290LCBjb252ZXJ0IHRoZSBwYXRoIHRvIGEgbG9uZyBVTkMgcGF0aFxuICAgICAgICByZXR1cm4gYFxcXFxcXFxcP1xcXFwke3Jlc29sdmVkUGF0aH1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgZGlyZWN0b3J5IG5hbWUgb2YgYSBgcGF0aGAuXG4gKiBAcGFyYW0gcGF0aCB0byBkZXRlcm1pbmUgbmFtZSBmb3JcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpcm5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgY29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG4gIGlmIChsZW4gPT09IDApIHJldHVybiBcIi5cIjtcbiAgbGV0IHJvb3RFbmQgPSAtMTtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgbGV0IG9mZnNldCA9IDA7XG4gIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgLy8gVHJ5IHRvIG1hdGNoIGEgcm9vdFxuICBpZiAobGVuID4gMSkge1xuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIFVOQyByb290XG5cbiAgICAgIHJvb3RFbmQgPSBvZmZzZXQgPSAxO1xuXG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgxKSkpIHtcbiAgICAgICAgLy8gTWF0Y2hlZCBkb3VibGUgcGF0aCBzZXBhcmF0b3IgYXQgYmVnaW5uaW5nXG4gICAgICAgIGxldCBqID0gMjtcbiAgICAgICAgbGV0IGxhc3QgPSBqO1xuICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG4gICAgICAgICAgLy8gTWF0Y2hlZCFcbiAgICAgICAgICBsYXN0ID0gajtcbiAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgICAgZm9yICg7IGogPCBsZW47ICsraikge1xuICAgICAgICAgICAgaWYgKCFpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgIC8vIE1hdGNoZWQhXG4gICAgICAgICAgICBsYXN0ID0gajtcbiAgICAgICAgICAgIC8vIE1hdGNoIDEgb3IgbW9yZSBub24tcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaiA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgIC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCBvbmx5XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IHdpdGggbGVmdG92ZXJzXG5cbiAgICAgICAgICAgICAgLy8gT2Zmc2V0IGJ5IDEgdG8gaW5jbHVkZSB0aGUgc2VwYXJhdG9yIGFmdGVyIHRoZSBVTkMgcm9vdCB0b1xuICAgICAgICAgICAgICAvLyB0cmVhdCBpdCBhcyBhIFwibm9ybWFsIHJvb3RcIiBvbiB0b3Agb2YgYSAoVU5DKSByb290XG4gICAgICAgICAgICAgIHJvb3RFbmQgPSBvZmZzZXQgPSBqICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgIGlmIChwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04pIHtcbiAgICAgICAgcm9vdEVuZCA9IG9mZnNldCA9IDI7XG4gICAgICAgIGlmIChsZW4gPiAyKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMikpKSByb290RW5kID0gb2Zmc2V0ID0gMztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIHBhdGggc2VwYXJhdG9yLCBleGl0IGVhcmx5IHRvIGF2b2lkXG4gICAgLy8gdW5uZWNlc3Nhcnkgd29ya1xuICAgIHJldHVybiBwYXRoO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IGxlbiAtIDE7IGkgPj0gb2Zmc2V0OyAtLWkpIHtcbiAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChpKSkpIHtcbiAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgIGVuZCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvclxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICBpZiAocm9vdEVuZCA9PT0gLTEpIHJldHVybiBcIi5cIjtcbiAgICBlbHNlIGVuZCA9IHJvb3RFbmQ7XG4gIH1cbiAgcmV0dXJuIHBhdGguc2xpY2UoMCwgZW5kKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGxhc3QgcG9ydGlvbiBvZiBhIGBwYXRoYC4gVHJhaWxpbmcgZGlyZWN0b3J5IHNlcGFyYXRvcnMgYXJlIGlnbm9yZWQuXG4gKiBAcGFyYW0gcGF0aCB0byBwcm9jZXNzXG4gKiBAcGFyYW0gZXh0IG9mIHBhdGggZGlyZWN0b3J5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlbmFtZShwYXRoOiBzdHJpbmcsIGV4dCA9IFwiXCIpOiBzdHJpbmcge1xuICBpZiAoZXh0ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGV4dCAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiZXh0XCIgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZycpO1xuICB9XG5cbiAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgZW5kID0gLTE7XG4gIGxldCBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICBsZXQgaTogbnVtYmVyO1xuXG4gIC8vIENoZWNrIGZvciBhIGRyaXZlIGxldHRlciBwcmVmaXggc28gYXMgbm90IHRvIG1pc3Rha2UgdGhlIGZvbGxvd2luZ1xuICAvLyBwYXRoIHNlcGFyYXRvciBhcyBhbiBleHRyYSBzZXBhcmF0b3IgYXQgdGhlIGVuZCBvZiB0aGUgcGF0aCB0aGF0IGNhbiBiZVxuICAvLyBkaXNyZWdhcmRlZFxuICBpZiAocGF0aC5sZW5ndGggPj0gMikge1xuICAgIGNvbnN0IGRyaXZlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuICAgIGlmIChpc1dpbmRvd3NEZXZpY2VSb290KGRyaXZlKSkge1xuICAgICAgaWYgKHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikgc3RhcnQgPSAyO1xuICAgIH1cbiAgfVxuXG4gIGlmIChleHQgIT09IHVuZGVmaW5lZCAmJiBleHQubGVuZ3RoID4gMCAmJiBleHQubGVuZ3RoIDw9IHBhdGgubGVuZ3RoKSB7XG4gICAgaWYgKGV4dC5sZW5ndGggPT09IHBhdGgubGVuZ3RoICYmIGV4dCA9PT0gcGF0aCkgcmV0dXJuIFwiXCI7XG4gICAgbGV0IGV4dElkeCA9IGV4dC5sZW5ndGggLSAxO1xuICAgIGxldCBmaXJzdE5vblNsYXNoRW5kID0gLTE7XG4gICAgZm9yIChpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IHN0YXJ0OyAtLWkpIHtcbiAgICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmaXJzdE5vblNsYXNoRW5kID09PSAtMSkge1xuICAgICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCByZW1lbWJlciB0aGlzIGluZGV4IGluIGNhc2VcbiAgICAgICAgICAvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcbiAgICAgICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgICAgICBmaXJzdE5vblNsYXNoRW5kID0gaSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4dElkeCA+PSAwKSB7XG4gICAgICAgICAgLy8gVHJ5IHRvIG1hdGNoIHRoZSBleHBsaWNpdCBleHRlbnNpb25cbiAgICAgICAgICBpZiAoY29kZSA9PT0gZXh0LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuICAgICAgICAgICAgaWYgKC0tZXh0SWR4ID09PSAtMSkge1xuICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIHRoZSBleHRlbnNpb24sIHNvIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91ciBwYXRoXG4gICAgICAgICAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgICAgICAgICBlbmQgPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFeHRlbnNpb24gZG9lcyBub3QgbWF0Y2gsIHNvIG91ciByZXN1bHQgaXMgdGhlIGVudGlyZSBwYXRoXG4gICAgICAgICAgICAvLyBjb21wb25lbnRcbiAgICAgICAgICAgIGV4dElkeCA9IC0xO1xuICAgICAgICAgICAgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPT09IGVuZCkgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICBlbHNlIGlmIChlbmQgPT09IC0xKSBlbmQgPSBwYXRoLmxlbmd0aDtcbiAgICByZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gc3RhcnQ7IC0taSkge1xuICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaSkpKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZW5kID09PSAtMSkge1xuICAgICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAgIC8vIHBhdGggY29tcG9uZW50XG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZW5kID09PSAtMSkgcmV0dXJuIFwiXCI7XG4gICAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGV4dGVuc2lvbiBvZiB0aGUgYHBhdGhgLlxuICogQHBhcmFtIHBhdGggd2l0aCBleHRlbnNpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dG5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgbGV0IHN0YXJ0ID0gMDtcbiAgbGV0IHN0YXJ0RG90ID0gLTE7XG4gIGxldCBzdGFydFBhcnQgPSAwO1xuICBsZXQgZW5kID0gLTE7XG4gIGxldCBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAvLyBUcmFjayB0aGUgc3RhdGUgb2YgY2hhcmFjdGVycyAoaWYgYW55KSB3ZSBzZWUgYmVmb3JlIG91ciBmaXJzdCBkb3QgYW5kXG4gIC8vIGFmdGVyIGFueSBwYXRoIHNlcGFyYXRvciB3ZSBmaW5kXG4gIGxldCBwcmVEb3RTdGF0ZSA9IDA7XG5cbiAgLy8gQ2hlY2sgZm9yIGEgZHJpdmUgbGV0dGVyIHByZWZpeCBzbyBhcyBub3QgdG8gbWlzdGFrZSB0aGUgZm9sbG93aW5nXG4gIC8vIHBhdGggc2VwYXJhdG9yIGFzIGFuIGV4dHJhIHNlcGFyYXRvciBhdCB0aGUgZW5kIG9mIHRoZSBwYXRoIHRoYXQgY2FuIGJlXG4gIC8vIGRpc3JlZ2FyZGVkXG5cbiAgaWYgKFxuICAgIHBhdGgubGVuZ3RoID49IDIgJiZcbiAgICBwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04gJiZcbiAgICBpc1dpbmRvd3NEZXZpY2VSb290KHBhdGguY2hhckNvZGVBdCgwKSlcbiAgKSB7XG4gICAgc3RhcnQgPSBzdGFydFBhcnQgPSAyO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSBzdGFydDsgLS1pKSB7XG4gICAgY29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdChpKTtcbiAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICBzdGFydFBhcnQgPSBpICsgMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgIC8vIGV4dGVuc2lvblxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgICBlbmQgPSBpICsgMTtcbiAgICB9XG4gICAgaWYgKGNvZGUgPT09IENIQVJfRE9UKSB7XG4gICAgICAvLyBJZiB0aGlzIGlzIG91ciBmaXJzdCBkb3QsIG1hcmsgaXQgYXMgdGhlIHN0YXJ0IG9mIG91ciBleHRlbnNpb25cbiAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpIHN0YXJ0RG90ID0gaTtcbiAgICAgIGVsc2UgaWYgKHByZURvdFN0YXRlICE9PSAxKSBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgfSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgYW5kIG5vbi1wYXRoIHNlcGFyYXRvciBiZWZvcmUgb3VyIGRvdCwgc28gd2Ugc2hvdWxkXG4gICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgcHJlRG90U3RhdGUgPSAtMTtcbiAgICB9XG4gIH1cblxuICBpZiAoXG4gICAgc3RhcnREb3QgPT09IC0xIHx8XG4gICAgZW5kID09PSAtMSB8fFxuICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgcHJlRG90U3RhdGUgPT09IDAgfHxcbiAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgKHByZURvdFN0YXRlID09PSAxICYmIHN0YXJ0RG90ID09PSBlbmQgLSAxICYmIHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKVxuICApIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuICByZXR1cm4gcGF0aC5zbGljZShzdGFydERvdCwgZW5kKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBhIHBhdGggZnJvbSBgRm9ybWF0SW5wdXRQYXRoT2JqZWN0YCBvYmplY3QuXG4gKiBAcGFyYW0gcGF0aE9iamVjdCB3aXRoIHBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdChwYXRoT2JqZWN0OiBGb3JtYXRJbnB1dFBhdGhPYmplY3QpOiBzdHJpbmcge1xuICBpZiAocGF0aE9iamVjdCA9PT0gbnVsbCB8fCB0eXBlb2YgcGF0aE9iamVjdCAhPT0gXCJvYmplY3RcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBgVGhlIFwicGF0aE9iamVjdFwiIGFyZ3VtZW50IG11c3QgYmUgb2YgdHlwZSBPYmplY3QuIFJlY2VpdmVkIHR5cGUgJHt0eXBlb2YgcGF0aE9iamVjdH1gLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIF9mb3JtYXQoXCJcXFxcXCIsIHBhdGhPYmplY3QpO1xufVxuXG4vKipcbiAqIFJldHVybiBhIGBQYXJzZWRQYXRoYCBvYmplY3Qgb2YgdGhlIGBwYXRoYC5cbiAqIEBwYXJhbSBwYXRoIHRvIHByb2Nlc3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKHBhdGg6IHN0cmluZyk6IFBhcnNlZFBhdGgge1xuICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gIGNvbnN0IHJldDogUGFyc2VkUGF0aCA9IHsgcm9vdDogXCJcIiwgZGlyOiBcIlwiLCBiYXNlOiBcIlwiLCBleHQ6IFwiXCIsIG5hbWU6IFwiXCIgfTtcblxuICBjb25zdCBsZW4gPSBwYXRoLmxlbmd0aDtcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIHJldDtcblxuICBsZXQgcm9vdEVuZCA9IDA7XG4gIGxldCBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuXG4gIC8vIFRyeSB0byBtYXRjaCBhIHJvb3RcbiAgaWYgKGxlbiA+IDEpIHtcbiAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAvLyBQb3NzaWJsZSBVTkMgcm9vdFxuXG4gICAgICByb290RW5kID0gMTtcbiAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDEpKSkge1xuICAgICAgICAvLyBNYXRjaGVkIGRvdWJsZSBwYXRoIHNlcGFyYXRvciBhdCBiZWdpbm5pbmdcbiAgICAgICAgbGV0IGogPSAyO1xuICAgICAgICBsZXQgbGFzdCA9IGo7XG4gICAgICAgIC8vIE1hdGNoIDEgb3IgbW9yZSBub24tcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcbiAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgIGxhc3QgPSBqO1xuICAgICAgICAgIC8vIE1hdGNoIDEgb3IgbW9yZSBwYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICBpZiAoIWlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuICAgICAgICAgICAgLy8gTWF0Y2hlZCFcbiAgICAgICAgICAgIGxhc3QgPSBqO1xuICAgICAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChqID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IG9ubHlcblxuICAgICAgICAgICAgICByb290RW5kID0gajtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaiAhPT0gbGFzdCkge1xuICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIGEgVU5DIHJvb3Qgd2l0aCBsZWZ0b3ZlcnNcblxuICAgICAgICAgICAgICByb290RW5kID0gaiArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1dpbmRvd3NEZXZpY2VSb290KGNvZGUpKSB7XG4gICAgICAvLyBQb3NzaWJsZSBkZXZpY2Ugcm9vdFxuXG4gICAgICBpZiAocGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OKSB7XG4gICAgICAgIHJvb3RFbmQgPSAyO1xuICAgICAgICBpZiAobGVuID4gMikge1xuICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDIpKSkge1xuICAgICAgICAgICAgaWYgKGxlbiA9PT0gMykge1xuICAgICAgICAgICAgICAvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIGRyaXZlIHJvb3QsIGV4aXQgZWFybHkgdG8gYXZvaWRcbiAgICAgICAgICAgICAgLy8gdW5uZWNlc3Nhcnkgd29ya1xuICAgICAgICAgICAgICByZXQucm9vdCA9IHJldC5kaXIgPSBwYXRoO1xuICAgICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcm9vdEVuZCA9IDM7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGBwYXRoYCBjb250YWlucyBqdXN0IGEgZHJpdmUgcm9vdCwgZXhpdCBlYXJseSB0byBhdm9pZFxuICAgICAgICAgIC8vIHVubmVjZXNzYXJ5IHdvcmtcbiAgICAgICAgICByZXQucm9vdCA9IHJldC5kaXIgPSBwYXRoO1xuICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgLy8gYHBhdGhgIGNvbnRhaW5zIGp1c3QgYSBwYXRoIHNlcGFyYXRvciwgZXhpdCBlYXJseSB0byBhdm9pZFxuICAgIC8vIHVubmVjZXNzYXJ5IHdvcmtcbiAgICByZXQucm9vdCA9IHJldC5kaXIgPSBwYXRoO1xuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICBpZiAocm9vdEVuZCA+IDApIHJldC5yb290ID0gcGF0aC5zbGljZSgwLCByb290RW5kKTtcblxuICBsZXQgc3RhcnREb3QgPSAtMTtcbiAgbGV0IHN0YXJ0UGFydCA9IHJvb3RFbmQ7XG4gIGxldCBlbmQgPSAtMTtcbiAgbGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG4gIGxldCBpID0gcGF0aC5sZW5ndGggLSAxO1xuXG4gIC8vIFRyYWNrIHRoZSBzdGF0ZSBvZiBjaGFyYWN0ZXJzIChpZiBhbnkpIHdlIHNlZSBiZWZvcmUgb3VyIGZpcnN0IGRvdCBhbmRcbiAgLy8gYWZ0ZXIgYW55IHBhdGggc2VwYXJhdG9yIHdlIGZpbmRcbiAgbGV0IHByZURvdFN0YXRlID0gMDtcblxuICAvLyBHZXQgbm9uLWRpciBpbmZvXG4gIGZvciAoOyBpID49IHJvb3RFbmQ7IC0taSkge1xuICAgIGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgaWYgKCFtYXRjaGVkU2xhc2gpIHtcbiAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAvLyBleHRlbnNpb25cbiAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgZW5kID0gaSArIDE7XG4gICAgfVxuICAgIGlmIChjb2RlID09PSBDSEFSX0RPVCkge1xuICAgICAgLy8gSWYgdGhpcyBpcyBvdXIgZmlyc3QgZG90LCBtYXJrIGl0IGFzIHRoZSBzdGFydCBvZiBvdXIgZXh0ZW5zaW9uXG4gICAgICBpZiAoc3RhcnREb3QgPT09IC0xKSBzdGFydERvdCA9IGk7XG4gICAgICBlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkgcHJlRG90U3RhdGUgPSAxO1xuICAgIH0gZWxzZSBpZiAoc3RhcnREb3QgIT09IC0xKSB7XG4gICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgLy8gaGF2ZSBhIGdvb2QgY2hhbmNlIGF0IGhhdmluZyBhIG5vbi1lbXB0eSBleHRlbnNpb25cbiAgICAgIHByZURvdFN0YXRlID0gLTE7XG4gICAgfVxuICB9XG5cbiAgaWYgKFxuICAgIHN0YXJ0RG90ID09PSAtMSB8fFxuICAgIGVuZCA9PT0gLTEgfHxcbiAgICAvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuICAgIHByZURvdFN0YXRlID09PSAwIHx8XG4gICAgLy8gVGhlIChyaWdodC1tb3N0KSB0cmltbWVkIHBhdGggY29tcG9uZW50IGlzIGV4YWN0bHkgJy4uJ1xuICAgIChwcmVEb3RTdGF0ZSA9PT0gMSAmJiBzdGFydERvdCA9PT0gZW5kIC0gMSAmJiBzdGFydERvdCA9PT0gc3RhcnRQYXJ0ICsgMSlcbiAgKSB7XG4gICAgaWYgKGVuZCAhPT0gLTEpIHtcbiAgICAgIHJldC5iYXNlID0gcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgZW5kKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgc3RhcnREb3QpO1xuICAgIHJldC5iYXNlID0gcGF0aC5zbGljZShzdGFydFBhcnQsIGVuZCk7XG4gICAgcmV0LmV4dCA9IHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG4gIH1cblxuICAvLyBJZiB0aGUgZGlyZWN0b3J5IGlzIHRoZSByb290LCB1c2UgdGhlIGVudGlyZSByb290IGFzIHRoZSBgZGlyYCBpbmNsdWRpbmdcbiAgLy8gdGhlIHRyYWlsaW5nIHNsYXNoIGlmIGFueSAoYEM6XFxhYmNgIC0+IGBDOlxcYCkuIE90aGVyd2lzZSwgc3RyaXAgb3V0IHRoZVxuICAvLyB0cmFpbGluZyBzbGFzaCAoYEM6XFxhYmNcXGRlZmAgLT4gYEM6XFxhYmNgKS5cbiAgaWYgKHN0YXJ0UGFydCA+IDAgJiYgc3RhcnRQYXJ0ICE9PSByb290RW5kKSB7XG4gICAgcmV0LmRpciA9IHBhdGguc2xpY2UoMCwgc3RhcnRQYXJ0IC0gMSk7XG4gIH0gZWxzZSByZXQuZGlyID0gcmV0LnJvb3Q7XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIGZpbGUgVVJMIHRvIGEgcGF0aCBzdHJpbmcuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgZnJvbUZpbGVVcmwgfSBmcm9tIFwiLi93aW4zMi50c1wiO1xuICogICAgICBmcm9tRmlsZVVybChcImZpbGU6Ly8vaG9tZS9mb29cIik7IC8vIFwiXFxcXGhvbWVcXFxcZm9vXCJcbiAqICAgICAgZnJvbUZpbGVVcmwoXCJmaWxlOi8vL0M6L1VzZXJzL2Zvb1wiKTsgLy8gXCJDOlxcXFxVc2Vyc1xcXFxmb29cIlxuICogICAgICBmcm9tRmlsZVVybChcImZpbGU6Ly9sb2NhbGhvc3QvaG9tZS9mb29cIik7IC8vIFwiXFxcXFxcXFxsb2NhbGhvc3RcXFxcaG9tZVxcXFxmb29cIlxuICogYGBgXG4gKiBAcGFyYW0gdXJsIG9mIGEgZmlsZSBVUkxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21GaWxlVXJsKHVybDogc3RyaW5nIHwgVVJMKTogc3RyaW5nIHtcbiAgdXJsID0gdXJsIGluc3RhbmNlb2YgVVJMID8gdXJsIDogbmV3IFVSTCh1cmwpO1xuICBpZiAodXJsLnByb3RvY29sICE9IFwiZmlsZTpcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJNdXN0IGJlIGEgZmlsZSBVUkwuXCIpO1xuICB9XG4gIGxldCBwYXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KFxuICAgIHVybC5wYXRobmFtZS5yZXBsYWNlKC9cXC8vZywgXCJcXFxcXCIpLnJlcGxhY2UoLyUoPyFbMC05QS1GYS1mXXsyfSkvZywgXCIlMjVcIiksXG4gICkucmVwbGFjZSgvXlxcXFwqKFtBLVphLXpdOikoXFxcXHwkKS8sIFwiJDFcXFxcXCIpO1xuICBpZiAodXJsLmhvc3RuYW1lICE9IFwiXCIpIHtcbiAgICAvLyBOb3RlOiBUaGUgYFVSTGAgaW1wbGVtZW50YXRpb24gZ3VhcmFudGVlcyB0aGF0IHRoZSBkcml2ZSBsZXR0ZXIgYW5kXG4gICAgLy8gaG9zdG5hbWUgYXJlIG11dHVhbGx5IGV4Y2x1c2l2ZS4gT3RoZXJ3aXNlIGl0IHdvdWxkIG5vdCBoYXZlIGJlZW4gdmFsaWRcbiAgICAvLyB0byBhcHBlbmQgdGhlIGhvc3RuYW1lIGFuZCBwYXRoIGxpa2UgdGhpcy5cbiAgICBwYXRoID0gYFxcXFxcXFxcJHt1cmwuaG9zdG5hbWV9JHtwYXRofWA7XG4gIH1cbiAgcmV0dXJuIHBhdGg7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBwYXRoIHN0cmluZyB0byBhIGZpbGUgVVJMLlxuICpcbiAqIGBgYHRzXG4gKiAgICAgIGltcG9ydCB7IHRvRmlsZVVybCB9IGZyb20gXCIuL3dpbjMyLnRzXCI7XG4gKiAgICAgIHRvRmlsZVVybChcIlxcXFxob21lXFxcXGZvb1wiKTsgLy8gbmV3IFVSTChcImZpbGU6Ly8vaG9tZS9mb29cIilcbiAqICAgICAgdG9GaWxlVXJsKFwiQzpcXFxcVXNlcnNcXFxcZm9vXCIpOyAvLyBuZXcgVVJMKFwiZmlsZTovLy9DOi9Vc2Vycy9mb29cIilcbiAqICAgICAgdG9GaWxlVXJsKFwiXFxcXFxcXFwxMjcuMC4wLjFcXFxcaG9tZVxcXFxmb29cIik7IC8vIG5ldyBVUkwoXCJmaWxlOi8vMTI3LjAuMC4xL2hvbWUvZm9vXCIpXG4gKiBgYGBcbiAqIEBwYXJhbSBwYXRoIHRvIGNvbnZlcnQgdG8gZmlsZSBVUkxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvRmlsZVVybChwYXRoOiBzdHJpbmcpOiBVUkwge1xuICBpZiAoIWlzQWJzb2x1dGUocGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiTXVzdCBiZSBhbiBhYnNvbHV0ZSBwYXRoLlwiKTtcbiAgfVxuICBjb25zdCBbLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gcGF0aC5tYXRjaChcbiAgICAvXig/OlsvXFxcXF17Mn0oW14vXFxcXF0rKSg/PVsvXFxcXF0oPzpbXi9cXFxcXXwkKSkpPyguKikvLFxuICApITtcbiAgY29uc3QgdXJsID0gbmV3IFVSTChcImZpbGU6Ly8vXCIpO1xuICB1cmwucGF0aG5hbWUgPSBlbmNvZGVXaGl0ZXNwYWNlKHBhdGhuYW1lLnJlcGxhY2UoLyUvZywgXCIlMjVcIikpO1xuICBpZiAoaG9zdG5hbWUgIT0gbnVsbCAmJiBob3N0bmFtZSAhPSBcImxvY2FsaG9zdFwiKSB7XG4gICAgdXJsLmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gICAgaWYgKCF1cmwuaG9zdG5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGhvc3RuYW1lLlwiKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHVybDtcbn1cbiJdfQ==