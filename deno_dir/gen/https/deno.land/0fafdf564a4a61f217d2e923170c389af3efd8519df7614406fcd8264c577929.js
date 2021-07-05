import { isWindows, osType } from "../_util/os.ts";
import { SEP, SEP_PATTERN } from "./separator.ts";
import * as _win32 from "./win32.ts";
import * as _posix from "./posix.ts";
const path = isWindows ? _win32 : _posix;
const { join, normalize } = path;
const regExpEscapeChars = ["!", "$", "(", ")", "*", "+", ".", "=", "?", "[", "\\", "^", "{", "|"];
const rangeEscapeChars = ["-", "\\", "]"];
export function globToRegExp(glob, { extended = true, globstar: globstarOption = true, os = osType, caseInsensitive = false, } = {}) {
    if (glob == "") {
        return /(?!)/;
    }
    const sep = os == "windows" ? "(?:\\\\|/)+" : "/+";
    const sepMaybe = os == "windows" ? "(?:\\\\|/)*" : "/*";
    const seps = os == "windows" ? ["\\", "/"] : ["/"];
    const globstar = os == "windows"
        ? "(?:[^\\\\/]*(?:\\\\|/|$)+)*"
        : "(?:[^/]*(?:/|$)+)*";
    const wildcard = os == "windows" ? "[^\\\\/]*" : "[^/]*";
    const escapePrefix = os == "windows" ? "`" : "\\";
    let newLength = glob.length;
    for (; newLength > 1 && seps.includes(glob[newLength - 1]); newLength--)
        ;
    glob = glob.slice(0, newLength);
    let regExpString = "";
    for (let j = 0; j < glob.length;) {
        let segment = "";
        const groupStack = [];
        let inRange = false;
        let inEscape = false;
        let endsWithSep = false;
        let i = j;
        for (; i < glob.length && !seps.includes(glob[i]); i++) {
            if (inEscape) {
                inEscape = false;
                const escapeChars = inRange ? rangeEscapeChars : regExpEscapeChars;
                segment += escapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
                continue;
            }
            if (glob[i] == escapePrefix) {
                inEscape = true;
                continue;
            }
            if (glob[i] == "[") {
                if (!inRange) {
                    inRange = true;
                    segment += "[";
                    if (glob[i + 1] == "!") {
                        i++;
                        segment += "^";
                    }
                    else if (glob[i + 1] == "^") {
                        i++;
                        segment += "\\^";
                    }
                    continue;
                }
                else if (glob[i + 1] == ":") {
                    let k = i + 1;
                    let value = "";
                    while (glob[k + 1] != null && glob[k + 1] != ":") {
                        value += glob[k + 1];
                        k++;
                    }
                    if (glob[k + 1] == ":" && glob[k + 2] == "]") {
                        i = k + 2;
                        if (value == "alnum")
                            segment += "\\dA-Za-z";
                        else if (value == "alpha")
                            segment += "A-Za-z";
                        else if (value == "ascii")
                            segment += "\x00-\x7F";
                        else if (value == "blank")
                            segment += "\t ";
                        else if (value == "cntrl")
                            segment += "\x00-\x1F\x7F";
                        else if (value == "digit")
                            segment += "\\d";
                        else if (value == "graph")
                            segment += "\x21-\x7E";
                        else if (value == "lower")
                            segment += "a-z";
                        else if (value == "print")
                            segment += "\x20-\x7E";
                        else if (value == "punct") {
                            segment += "!\"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_‘{|}~";
                        }
                        else if (value == "space")
                            segment += "\\s\v";
                        else if (value == "upper")
                            segment += "A-Z";
                        else if (value == "word")
                            segment += "\\w";
                        else if (value == "xdigit")
                            segment += "\\dA-Fa-f";
                        continue;
                    }
                }
            }
            if (glob[i] == "]" && inRange) {
                inRange = false;
                segment += "]";
                continue;
            }
            if (inRange) {
                if (glob[i] == "\\") {
                    segment += `\\\\`;
                }
                else {
                    segment += glob[i];
                }
                continue;
            }
            if (glob[i] == ")" && groupStack.length > 0 &&
                groupStack[groupStack.length - 1] != "BRACE") {
                segment += ")";
                const type = groupStack.pop();
                if (type == "!") {
                    segment += wildcard;
                }
                else if (type != "@") {
                    segment += type;
                }
                continue;
            }
            if (glob[i] == "|" && groupStack.length > 0 &&
                groupStack[groupStack.length - 1] != "BRACE") {
                segment += "|";
                continue;
            }
            if (glob[i] == "+" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("+");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "@" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("@");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "?") {
                if (extended && glob[i + 1] == "(") {
                    i++;
                    groupStack.push("?");
                    segment += "(?:";
                }
                else {
                    segment += ".";
                }
                continue;
            }
            if (glob[i] == "!" && extended && glob[i + 1] == "(") {
                i++;
                groupStack.push("!");
                segment += "(?!";
                continue;
            }
            if (glob[i] == "{") {
                groupStack.push("BRACE");
                segment += "(?:";
                continue;
            }
            if (glob[i] == "}" && groupStack[groupStack.length - 1] == "BRACE") {
                groupStack.pop();
                segment += ")";
                continue;
            }
            if (glob[i] == "," && groupStack[groupStack.length - 1] == "BRACE") {
                segment += "|";
                continue;
            }
            if (glob[i] == "*") {
                if (extended && glob[i + 1] == "(") {
                    i++;
                    groupStack.push("*");
                    segment += "(?:";
                }
                else {
                    const prevChar = glob[i - 1];
                    let numStars = 1;
                    while (glob[i + 1] == "*") {
                        i++;
                        numStars++;
                    }
                    const nextChar = glob[i + 1];
                    if (globstarOption && numStars == 2 &&
                        [...seps, undefined].includes(prevChar) &&
                        [...seps, undefined].includes(nextChar)) {
                        segment += globstar;
                        endsWithSep = true;
                    }
                    else {
                        segment += wildcard;
                    }
                }
                continue;
            }
            segment += regExpEscapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
        }
        if (groupStack.length > 0 || inRange || inEscape) {
            segment = "";
            for (const c of glob.slice(j, i)) {
                segment += regExpEscapeChars.includes(c) ? `\\${c}` : c;
                endsWithSep = false;
            }
        }
        regExpString += segment;
        if (!endsWithSep) {
            regExpString += i < glob.length ? sep : sepMaybe;
            endsWithSep = true;
        }
        while (seps.includes(glob[i]))
            i++;
        if (!(i > j)) {
            throw new Error("Assertion failure: i > j (potential infinite loop)");
        }
        j = i;
    }
    regExpString = `^${regExpString}$`;
    return new RegExp(regExpString, caseInsensitive ? "i" : "");
}
export function isGlob(str) {
    const chars = { "{": "}", "(": ")", "[": "]" };
    const regex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
    if (str === "") {
        return false;
    }
    let match;
    while ((match = regex.exec(str))) {
        if (match[2])
            return true;
        let idx = match.index + match[0].length;
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = str.indexOf(close, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }
        str = str.slice(idx);
    }
    return false;
}
export function normalizeGlob(glob, { globstar = false } = {}) {
    if (glob.match(/\0/g)) {
        throw new Error(`Glob contains invalid characters: "${glob}"`);
    }
    if (!globstar) {
        return normalize(glob);
    }
    const s = SEP_PATTERN.source;
    const badParentPattern = new RegExp(`(?<=(${s}|^)\\*\\*${s})\\.\\.(?=${s}|$)`, "g");
    return normalize(glob.replace(badParentPattern, "\0")).replace(/\0/g, "..");
}
export function joinGlobs(globs, { extended = false, globstar = false } = {}) {
    if (!globstar || globs.length == 0) {
        return join(...globs);
    }
    if (globs.length === 0)
        return ".";
    let joined;
    for (const glob of globs) {
        const path = glob;
        if (path.length > 0) {
            if (!joined)
                joined = path;
            else
                joined += `${SEP}${path}`;
        }
    }
    if (!joined)
        return ".";
    return normalizeGlob(joined, { extended, globstar });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdsb2IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0EsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNuRCxPQUFPLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2xELE9BQU8sS0FBSyxNQUFNLE1BQU0sWUFBWSxDQUFDO0FBQ3JDLE9BQU8sS0FBSyxNQUFNLE1BQU0sWUFBWSxDQUFDO0FBRXJDLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDekMsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFvQmpDLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDbEcsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUF3RDFDLE1BQU0sVUFBVSxZQUFZLENBQzFCLElBQVksRUFDWixFQUNFLFFBQVEsR0FBRyxJQUFJLEVBQ2YsUUFBUSxFQUFFLGNBQWMsR0FBRyxJQUFJLEVBQy9CLEVBQUUsR0FBRyxNQUFNLEVBQ1gsZUFBZSxHQUFHLEtBQUssTUFDQSxFQUFFO0lBRTNCLElBQUksSUFBSSxJQUFJLEVBQUUsRUFBRTtRQUNkLE9BQU8sTUFBTSxDQUFDO0tBQ2Y7SUFFRCxNQUFNLEdBQUcsR0FBRyxFQUFFLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FB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