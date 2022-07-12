// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { isWindows, osType } from "../_util/os.ts";
import { SEP, SEP_PATTERN } from "./separator.ts";
import * as _win32 from "./win32.ts";
import * as _posix from "./posix.ts";
const path = isWindows ? _win32 : _posix;
const { join , normalize  } = path;
const regExpEscapeChars = [
    "!",
    "$",
    "(",
    ")",
    "*",
    "+",
    ".",
    "=",
    "?",
    "[",
    "\\",
    "^",
    "{",
    "|", 
];
const rangeEscapeChars = [
    "-",
    "\\",
    "]"
];
/** Convert a glob string to a regular expression.
 *
 * Tries to match bash glob expansion as closely as possible.
 *
 * Basic glob syntax:
 * - `*` - Matches everything without leaving the path segment.
 * - `?` - Matches any single character.
 * - `{foo,bar}` - Matches `foo` or `bar`.
 * - `[abcd]` - Matches `a`, `b`, `c` or `d`.
 * - `[a-d]` - Matches `a`, `b`, `c` or `d`.
 * - `[!abcd]` - Matches any single character besides `a`, `b`, `c` or `d`.
 * - `[[:<class>:]]` - Matches any character belonging to `<class>`.
 *     - `[[:alnum:]]` - Matches any digit or letter.
 *     - `[[:digit:]abc]` - Matches any digit, `a`, `b` or `c`.
 *     - See https://facelessuser.github.io/wcmatch/glob/#posix-character-classes
 *       for a complete list of supported character classes.
 * - `\` - Escapes the next character for an `os` other than `"windows"`.
 * - \` - Escapes the next character for `os` set to `"windows"`.
 * - `/` - Path separator.
 * - `\` - Additional path separator only for `os` set to `"windows"`.
 *
 * Extended syntax:
 * - Requires `{ extended: true }`.
 * - `?(foo|bar)` - Matches 0 or 1 instance of `{foo,bar}`.
 * - `@(foo|bar)` - Matches 1 instance of `{foo,bar}`. They behave the same.
 * - `*(foo|bar)` - Matches _n_ instances of `{foo,bar}`.
 * - `+(foo|bar)` - Matches _n > 0_ instances of `{foo,bar}`.
 * - `!(foo|bar)` - Matches anything other than `{foo,bar}`.
 * - See https://www.linuxjournal.com/content/bash-extended-globbing.
 *
 * Globstar syntax:
 * - Requires `{ globstar: true }`.
 * - `**` - Matches any number of any path segments.
 *     - Must comprise its entire path segment in the provided glob.
 * - See https://www.linuxjournal.com/content/globstar-new-bash-globbing-option.
 *
 * Note the following properties:
 * - The generated `RegExp` is anchored at both start and end.
 * - Repeating and trailing separators are tolerated. Trailing separators in the
 *   provided glob have no meaning and are discarded.
 * - Absolute globs will only match absolute paths, etc.
 * - Empty globs will match nothing.
 * - Any special glob syntax must be contained to one path segment. For example,
 *   `?(foo|bar/baz)` is invalid. The separator will take precedence and the
 *   first segment ends with an unclosed group.
 * - If a path segment ends with unclosed groups or a dangling escape prefix, a
 *   parse error has occurred. Every character for that segment is taken
 *   literally in this event.
 *
 * Limitations:
 * - A negative group like `!(foo|bar)` will wrongly be converted to a negative
 *   look-ahead followed by a wildcard. This means that `!(foo).js` will wrongly
 *   fail to match `foobar.js`, even though `foobar` is not `foo`. Effectively,
 *   `!(foo|bar)` is treated like `!(@(foo|bar)*)`. This will work correctly if
 *   the group occurs not nested at the end of the segment. */ export function globToRegExp(glob, { extended =true , globstar: globstarOption = true , os =osType , caseInsensitive =false  } = {}) {
    if (glob == "") {
        return /(?!)/;
    }
    const sep = os == "windows" ? "(?:\\\\|/)+" : "/+";
    const sepMaybe = os == "windows" ? "(?:\\\\|/)*" : "/*";
    const seps = os == "windows" ? [
        "\\",
        "/"
    ] : [
        "/"
    ];
    const globstar = os == "windows" ? "(?:[^\\\\/]*(?:\\\\|/|$)+)*" : "(?:[^/]*(?:/|$)+)*";
    const wildcard = os == "windows" ? "[^\\\\/]*" : "[^/]*";
    const escapePrefix = os == "windows" ? "`" : "\\";
    // Remove trailing separators.
    let newLength = glob.length;
    for(; newLength > 1 && seps.includes(glob[newLength - 1]); newLength--);
    glob = glob.slice(0, newLength);
    let regExpString = "";
    // Terminates correctly. Trust that `j` is incremented every iteration.
    for(let j = 0; j < glob.length;){
        let segment = "";
        const groupStack = [];
        let inRange = false;
        let inEscape = false;
        let endsWithSep = false;
        let i = j;
        // Terminates with `i` at the non-inclusive end of the current segment.
        for(; i < glob.length && !seps.includes(glob[i]); i++){
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
                    } else if (glob[i + 1] == "^") {
                        i++;
                        segment += "\\^";
                    }
                    continue;
                } else if (glob[i + 1] == ":") {
                    let k = i + 1;
                    let value = "";
                    while(glob[k + 1] != null && glob[k + 1] != ":"){
                        value += glob[k + 1];
                        k++;
                    }
                    if (glob[k + 1] == ":" && glob[k + 2] == "]") {
                        i = k + 2;
                        if (value == "alnum") segment += "\\dA-Za-z";
                        else if (value == "alpha") segment += "A-Za-z";
                        else if (value == "ascii") segment += "\x00-\x7F";
                        else if (value == "blank") segment += "\t ";
                        else if (value == "cntrl") segment += "\x00-\x1F\x7F";
                        else if (value == "digit") segment += "\\d";
                        else if (value == "graph") segment += "\x21-\x7E";
                        else if (value == "lower") segment += "a-z";
                        else if (value == "print") segment += "\x20-\x7E";
                        else if (value == "punct") {
                            segment += "!\"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_‘{|}~";
                        } else if (value == "space") segment += "\\s\v";
                        else if (value == "upper") segment += "A-Z";
                        else if (value == "word") segment += "\\w";
                        else if (value == "xdigit") segment += "\\dA-Fa-f";
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
                } else {
                    segment += glob[i];
                }
                continue;
            }
            if (glob[i] == ")" && groupStack.length > 0 && groupStack[groupStack.length - 1] != "BRACE") {
                segment += ")";
                const type = groupStack.pop();
                if (type == "!") {
                    segment += wildcard;
                } else if (type != "@") {
                    segment += type;
                }
                continue;
            }
            if (glob[i] == "|" && groupStack.length > 0 && groupStack[groupStack.length - 1] != "BRACE") {
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
                } else {
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
                } else {
                    const prevChar = glob[i - 1];
                    let numStars = 1;
                    while(glob[i + 1] == "*"){
                        i++;
                        numStars++;
                    }
                    const nextChar = glob[i + 1];
                    if (globstarOption && numStars == 2 && [
                        ...seps,
                        undefined
                    ].includes(prevChar) && [
                        ...seps,
                        undefined
                    ].includes(nextChar)) {
                        segment += globstar;
                        endsWithSep = true;
                    } else {
                        segment += wildcard;
                    }
                }
                continue;
            }
            segment += regExpEscapeChars.includes(glob[i]) ? `\\${glob[i]}` : glob[i];
        }
        // Check for unclosed groups or a dangling backslash.
        if (groupStack.length > 0 || inRange || inEscape) {
            // Parse failure. Take all characters from this segment literally.
            segment = "";
            for (const c of glob.slice(j, i)){
                segment += regExpEscapeChars.includes(c) ? `\\${c}` : c;
                endsWithSep = false;
            }
        }
        regExpString += segment;
        if (!endsWithSep) {
            regExpString += i < glob.length ? sep : sepMaybe;
            endsWithSep = true;
        }
        // Terminates with `i` at the start of the next segment.
        while(seps.includes(glob[i]))i++;
        // Check that the next value of `j` is indeed higher than the current value.
        if (!(i > j)) {
            throw new Error("Assertion failure: i > j (potential infinite loop)");
        }
        j = i;
    }
    regExpString = `^${regExpString}$`;
    return new RegExp(regExpString, caseInsensitive ? "i" : "");
}
/** Test whether the given string is a glob */ export function isGlob(str) {
    const chars = {
        "{": "}",
        "(": ")",
        "[": "]"
    };
    const regex = /\\(.)|(^!|\*|\?|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
    if (str === "") {
        return false;
    }
    let match;
    while(match = regex.exec(str)){
        if (match[2]) return true;
        let idx = match.index + match[0].length;
        // if an open bracket/brace/paren is escaped,
        // set the index to the next closing character
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
/** Like normalize(), but doesn't collapse "**\/.." when `globstar` is true. */ export function normalizeGlob(glob, { globstar =false  } = {}) {
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
/** Like join(), but doesn't collapse "**\/.." when `globstar` is true. */ export function joinGlobs(globs, { extended =true , globstar =false  } = {}) {
    if (!globstar || globs.length == 0) {
        return join(...globs);
    }
    if (globs.length === 0) return ".";
    let joined;
    for (const glob of globs){
        const path = glob;
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `${SEP}${path}`;
        }
    }
    if (!joined) return ".";
    return normalizeGlob(joined, {
        extended,
        globstar
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL3BhdGgvZ2xvYi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQgeyBpc1dpbmRvd3MsIG9zVHlwZSB9IGZyb20gXCIuLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHsgU0VQLCBTRVBfUEFUVEVSTiB9IGZyb20gXCIuL3NlcGFyYXRvci50c1wiO1xuaW1wb3J0ICogYXMgX3dpbjMyIGZyb20gXCIuL3dpbjMyLnRzXCI7XG5pbXBvcnQgKiBhcyBfcG9zaXggZnJvbSBcIi4vcG9zaXgudHNcIjtcbmltcG9ydCB0eXBlIHsgT1NUeXBlIH0gZnJvbSBcIi4uL191dGlsL29zLnRzXCI7XG5cbmNvbnN0IHBhdGggPSBpc1dpbmRvd3MgPyBfd2luMzIgOiBfcG9zaXg7XG5jb25zdCB7IGpvaW4sIG5vcm1hbGl6ZSB9ID0gcGF0aDtcblxuZXhwb3J0IGludGVyZmFjZSBHbG9iT3B0aW9ucyB7XG4gIC8qKiBFeHRlbmRlZCBnbG9iIHN5bnRheC5cbiAgICogU2VlIGh0dHBzOi8vd3d3LmxpbnV4am91cm5hbC5jb20vY29udGVudC9iYXNoLWV4dGVuZGVkLWdsb2JiaW5nLiBEZWZhdWx0c1xuICAgKiB0byB0cnVlLiAqL1xuICBleHRlbmRlZD86IGJvb2xlYW47XG4gIC8qKiBHbG9ic3RhciBzeW50YXguXG4gICAqIFNlZSBodHRwczovL3d3dy5saW51eGpvdXJuYWwuY29tL2NvbnRlbnQvZ2xvYnN0YXItbmV3LWJhc2gtZ2xvYmJpbmctb3B0aW9uLlxuICAgKiBJZiBmYWxzZSwgYCoqYCBpcyB0cmVhdGVkIGxpa2UgYCpgLiBEZWZhdWx0cyB0byB0cnVlLiAqL1xuICBnbG9ic3Rhcj86IGJvb2xlYW47XG4gIC8qKiBXaGV0aGVyIGdsb2JzdGFyIHNob3VsZCBiZSBjYXNlIGluc2Vuc2l0aXZlLiAqL1xuICBjYXNlSW5zZW5zaXRpdmU/OiBib29sZWFuO1xuICAvKiogT3BlcmF0aW5nIHN5c3RlbS4gRGVmYXVsdHMgdG8gdGhlIG5hdGl2ZSBPUy4gKi9cbiAgb3M/OiBPU1R5cGU7XG59XG5cbmV4cG9ydCB0eXBlIEdsb2JUb1JlZ0V4cE9wdGlvbnMgPSBHbG9iT3B0aW9ucztcblxuY29uc3QgcmVnRXhwRXNjYXBlQ2hhcnMgPSBbXG4gIFwiIVwiLFxuICBcIiRcIixcbiAgXCIoXCIsXG4gIFwiKVwiLFxuICBcIipcIixcbiAgXCIrXCIsXG4gIFwiLlwiLFxuICBcIj1cIixcbiAgXCI/XCIsXG4gIFwiW1wiLFxuICBcIlxcXFxcIixcbiAgXCJeXCIsXG4gIFwie1wiLFxuICBcInxcIixcbl07XG5jb25zdCByYW5nZUVzY2FwZUNoYXJzID0gW1wiLVwiLCBcIlxcXFxcIiwgXCJdXCJdO1xuXG4vKiogQ29udmVydCBhIGdsb2Igc3RyaW5nIHRvIGEgcmVndWxhciBleHByZXNzaW9uLlxuICpcbiAqIFRyaWVzIHRvIG1hdGNoIGJhc2ggZ2xvYiBleHBhbnNpb24gYXMgY2xvc2VseSBhcyBwb3NzaWJsZS5cbiAqXG4gKiBCYXNpYyBnbG9iIHN5bnRheDpcbiAqIC0gYCpgIC0gTWF0Y2hlcyBldmVyeXRoaW5nIHdpdGhvdXQgbGVhdmluZyB0aGUgcGF0aCBzZWdtZW50LlxuICogLSBgP2AgLSBNYXRjaGVzIGFueSBzaW5nbGUgY2hhcmFjdGVyLlxuICogLSBge2ZvbyxiYXJ9YCAtIE1hdGNoZXMgYGZvb2Agb3IgYGJhcmAuXG4gKiAtIGBbYWJjZF1gIC0gTWF0Y2hlcyBgYWAsIGBiYCwgYGNgIG9yIGBkYC5cbiAqIC0gYFthLWRdYCAtIE1hdGNoZXMgYGFgLCBgYmAsIGBjYCBvciBgZGAuXG4gKiAtIGBbIWFiY2RdYCAtIE1hdGNoZXMgYW55IHNpbmdsZSBjaGFyYWN0ZXIgYmVzaWRlcyBgYWAsIGBiYCwgYGNgIG9yIGBkYC5cbiAqIC0gYFtbOjxjbGFzcz46XV1gIC0gTWF0Y2hlcyBhbnkgY2hhcmFjdGVyIGJlbG9uZ2luZyB0byBgPGNsYXNzPmAuXG4gKiAgICAgLSBgW1s6YWxudW06XV1gIC0gTWF0Y2hlcyBhbnkgZGlnaXQgb3IgbGV0dGVyLlxuICogICAgIC0gYFtbOmRpZ2l0Ol1hYmNdYCAtIE1hdGNoZXMgYW55IGRpZ2l0LCBgYWAsIGBiYCBvciBgY2AuXG4gKiAgICAgLSBTZWUgaHR0cHM6Ly9mYWNlbGVzc3VzZXIuZ2l0aHViLmlvL3djbWF0Y2gvZ2xvYi8jcG9zaXgtY2hhcmFjdGVyLWNsYXNzZXNcbiAqICAgICAgIGZvciBhIGNvbXBsZXRlIGxpc3Qgb2Ygc3VwcG9ydGVkIGNoYXJhY3RlciBjbGFzc2VzLlxuICogLSBgXFxgIC0gRXNjYXBlcyB0aGUgbmV4dCBjaGFyYWN0ZXIgZm9yIGFuIGBvc2Agb3RoZXIgdGhhbiBgXCJ3aW5kb3dzXCJgLlxuICogLSBcXGAgLSBFc2NhcGVzIHRoZSBuZXh0IGNoYXJhY3RlciBmb3IgYG9zYCBzZXQgdG8gYFwid2luZG93c1wiYC5cbiAqIC0gYC9gIC0gUGF0aCBzZXBhcmF0b3IuXG4gKiAtIGBcXGAgLSBBZGRpdGlvbmFsIHBhdGggc2VwYXJhdG9yIG9ubHkgZm9yIGBvc2Agc2V0IHRvIGBcIndpbmRvd3NcImAuXG4gKlxuICogRXh0ZW5kZWQgc3ludGF4OlxuICogLSBSZXF1aXJlcyBgeyBleHRlbmRlZDogdHJ1ZSB9YC5cbiAqIC0gYD8oZm9vfGJhcilgIC0gTWF0Y2hlcyAwIG9yIDEgaW5zdGFuY2Ugb2YgYHtmb28sYmFyfWAuXG4gKiAtIGBAKGZvb3xiYXIpYCAtIE1hdGNoZXMgMSBpbnN0YW5jZSBvZiBge2ZvbyxiYXJ9YC4gVGhleSBiZWhhdmUgdGhlIHNhbWUuXG4gKiAtIGAqKGZvb3xiYXIpYCAtIE1hdGNoZXMgX25fIGluc3RhbmNlcyBvZiBge2ZvbyxiYXJ9YC5cbiAqIC0gYCsoZm9vfGJhcilgIC0gTWF0Y2hlcyBfbiA+IDBfIGluc3RhbmNlcyBvZiBge2ZvbyxiYXJ9YC5cbiAqIC0gYCEoZm9vfGJhcilgIC0gTWF0Y2hlcyBhbnl0aGluZyBvdGhlciB0aGFuIGB7Zm9vLGJhcn1gLlxuICogLSBTZWUgaHR0cHM6Ly93d3cubGludXhqb3VybmFsLmNvbS9jb250ZW50L2Jhc2gtZXh0ZW5kZWQtZ2xvYmJpbmcuXG4gKlxuICogR2xvYnN0YXIgc3ludGF4OlxuICogLSBSZXF1aXJlcyBgeyBnbG9ic3RhcjogdHJ1ZSB9YC5cbiAqIC0gYCoqYCAtIE1hdGNoZXMgYW55IG51bWJlciBvZiBhbnkgcGF0aCBzZWdtZW50cy5cbiAqICAgICAtIE11c3QgY29tcHJpc2UgaXRzIGVudGlyZSBwYXRoIHNlZ21lbnQgaW4gdGhlIHByb3ZpZGVkIGdsb2IuXG4gKiAtIFNlZSBodHRwczovL3d3dy5saW51eGpvdXJuYWwuY29tL2NvbnRlbnQvZ2xvYnN0YXItbmV3LWJhc2gtZ2xvYmJpbmctb3B0aW9uLlxuICpcbiAqIE5vdGUgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuICogLSBUaGUgZ2VuZXJhdGVkIGBSZWdFeHBgIGlzIGFuY2hvcmVkIGF0IGJvdGggc3RhcnQgYW5kIGVuZC5cbiAqIC0gUmVwZWF0aW5nIGFuZCB0cmFpbGluZyBzZXBhcmF0b3JzIGFyZSB0b2xlcmF0ZWQuIFRyYWlsaW5nIHNlcGFyYXRvcnMgaW4gdGhlXG4gKiAgIHByb3ZpZGVkIGdsb2IgaGF2ZSBubyBtZWFuaW5nIGFuZCBhcmUgZGlzY2FyZGVkLlxuICogLSBBYnNvbHV0ZSBnbG9icyB3aWxsIG9ubHkgbWF0Y2ggYWJzb2x1dGUgcGF0aHMsIGV0Yy5cbiAqIC0gRW1wdHkgZ2xvYnMgd2lsbCBtYXRjaCBub3RoaW5nLlxuICogLSBBbnkgc3BlY2lhbCBnbG9iIHN5bnRheCBtdXN0IGJlIGNvbnRhaW5lZCB0byBvbmUgcGF0aCBzZWdtZW50LiBGb3IgZXhhbXBsZSxcbiAqICAgYD8oZm9vfGJhci9iYXopYCBpcyBpbnZhbGlkLiBUaGUgc2VwYXJhdG9yIHdpbGwgdGFrZSBwcmVjZWRlbmNlIGFuZCB0aGVcbiAqICAgZmlyc3Qgc2VnbWVudCBlbmRzIHdpdGggYW4gdW5jbG9zZWQgZ3JvdXAuXG4gKiAtIElmIGEgcGF0aCBzZWdtZW50IGVuZHMgd2l0aCB1bmNsb3NlZCBncm91cHMgb3IgYSBkYW5nbGluZyBlc2NhcGUgcHJlZml4LCBhXG4gKiAgIHBhcnNlIGVycm9yIGhhcyBvY2N1cnJlZC4gRXZlcnkgY2hhcmFjdGVyIGZvciB0aGF0IHNlZ21lbnQgaXMgdGFrZW5cbiAqICAgbGl0ZXJhbGx5IGluIHRoaXMgZXZlbnQuXG4gKlxuICogTGltaXRhdGlvbnM6XG4gKiAtIEEgbmVnYXRpdmUgZ3JvdXAgbGlrZSBgIShmb298YmFyKWAgd2lsbCB3cm9uZ2x5IGJlIGNvbnZlcnRlZCB0byBhIG5lZ2F0aXZlXG4gKiAgIGxvb2stYWhlYWQgZm9sbG93ZWQgYnkgYSB3aWxkY2FyZC4gVGhpcyBtZWFucyB0aGF0IGAhKGZvbykuanNgIHdpbGwgd3JvbmdseVxuICogICBmYWlsIHRvIG1hdGNoIGBmb29iYXIuanNgLCBldmVuIHRob3VnaCBgZm9vYmFyYCBpcyBub3QgYGZvb2AuIEVmZmVjdGl2ZWx5LFxuICogICBgIShmb298YmFyKWAgaXMgdHJlYXRlZCBsaWtlIGAhKEAoZm9vfGJhcikqKWAuIFRoaXMgd2lsbCB3b3JrIGNvcnJlY3RseSBpZlxuICogICB0aGUgZ3JvdXAgb2NjdXJzIG5vdCBuZXN0ZWQgYXQgdGhlIGVuZCBvZiB0aGUgc2VnbWVudC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnbG9iVG9SZWdFeHAoXG4gIGdsb2I6IHN0cmluZyxcbiAge1xuICAgIGV4dGVuZGVkID0gdHJ1ZSxcbiAgICBnbG9ic3RhcjogZ2xvYnN0YXJPcHRpb24gPSB0cnVlLFxuICAgIG9zID0gb3NUeXBlLFxuICAgIGNhc2VJbnNlbnNpdGl2ZSA9IGZhbHNlLFxuICB9OiBHbG9iVG9SZWdFeHBPcHRpb25zID0ge30sXG4pOiBSZWdFeHAge1xuICBpZiAoZ2xvYiA9PSBcIlwiKSB7XG4gICAgcmV0dXJuIC8oPyEpLztcbiAgfVxuXG4gIGNvbnN0IHNlcCA9IG9zID09IFwid2luZG93c1wiID8gXCIoPzpcXFxcXFxcXHwvKStcIiA6IFwiLytcIjtcbiAgY29uc3Qgc2VwTWF5YmUgPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiKD86XFxcXFxcXFx8LykqXCIgOiBcIi8qXCI7XG4gIGNvbnN0IHNlcHMgPSBvcyA9PSBcIndpbmRvd3NcIiA/IFtcIlxcXFxcIiwgXCIvXCJdIDogW1wiL1wiXTtcbiAgY29uc3QgZ2xvYnN0YXIgPSBvcyA9PSBcIndpbmRvd3NcIlxuICAgID8gXCIoPzpbXlxcXFxcXFxcL10qKD86XFxcXFxcXFx8L3wkKSspKlwiXG4gICAgOiBcIig/OlteL10qKD86L3wkKSspKlwiO1xuICBjb25zdCB3aWxkY2FyZCA9IG9zID09IFwid2luZG93c1wiID8gXCJbXlxcXFxcXFxcL10qXCIgOiBcIlteL10qXCI7XG4gIGNvbnN0IGVzY2FwZVByZWZpeCA9IG9zID09IFwid2luZG93c1wiID8gXCJgXCIgOiBcIlxcXFxcIjtcblxuICAvLyBSZW1vdmUgdHJhaWxpbmcgc2VwYXJhdG9ycy5cbiAgbGV0IG5ld0xlbmd0aCA9IGdsb2IubGVuZ3RoO1xuICBmb3IgKDsgbmV3TGVuZ3RoID4gMSAmJiBzZXBzLmluY2x1ZGVzKGdsb2JbbmV3TGVuZ3RoIC0gMV0pOyBuZXdMZW5ndGgtLSk7XG4gIGdsb2IgPSBnbG9iLnNsaWNlKDAsIG5ld0xlbmd0aCk7XG5cbiAgbGV0IHJlZ0V4cFN0cmluZyA9IFwiXCI7XG5cbiAgLy8gVGVybWluYXRlcyBjb3JyZWN0bHkuIFRydXN0IHRoYXQgYGpgIGlzIGluY3JlbWVudGVkIGV2ZXJ5IGl0ZXJhdGlvbi5cbiAgZm9yIChsZXQgaiA9IDA7IGogPCBnbG9iLmxlbmd0aDspIHtcbiAgICBsZXQgc2VnbWVudCA9IFwiXCI7XG4gICAgY29uc3QgZ3JvdXBTdGFjazogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgaW5SYW5nZSA9IGZhbHNlO1xuICAgIGxldCBpbkVzY2FwZSA9IGZhbHNlO1xuICAgIGxldCBlbmRzV2l0aFNlcCA9IGZhbHNlO1xuICAgIGxldCBpID0gajtcblxuICAgIC8vIFRlcm1pbmF0ZXMgd2l0aCBgaWAgYXQgdGhlIG5vbi1pbmNsdXNpdmUgZW5kIG9mIHRoZSBjdXJyZW50IHNlZ21lbnQuXG4gICAgZm9yICg7IGkgPCBnbG9iLmxlbmd0aCAmJiAhc2Vwcy5pbmNsdWRlcyhnbG9iW2ldKTsgaSsrKSB7XG4gICAgICBpZiAoaW5Fc2NhcGUpIHtcbiAgICAgICAgaW5Fc2NhcGUgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgZXNjYXBlQ2hhcnMgPSBpblJhbmdlID8gcmFuZ2VFc2NhcGVDaGFycyA6IHJlZ0V4cEVzY2FwZUNoYXJzO1xuICAgICAgICBzZWdtZW50ICs9IGVzY2FwZUNoYXJzLmluY2x1ZGVzKGdsb2JbaV0pID8gYFxcXFwke2dsb2JbaV19YCA6IGdsb2JbaV07XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBlc2NhcGVQcmVmaXgpIHtcbiAgICAgICAgaW5Fc2NhcGUgPSB0cnVlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCJbXCIpIHtcbiAgICAgICAgaWYgKCFpblJhbmdlKSB7XG4gICAgICAgICAgaW5SYW5nZSA9IHRydWU7XG4gICAgICAgICAgc2VnbWVudCArPSBcIltcIjtcbiAgICAgICAgICBpZiAoZ2xvYltpICsgMV0gPT0gXCIhXCIpIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gXCJeXCI7XG4gICAgICAgICAgfSBlbHNlIGlmIChnbG9iW2kgKyAxXSA9PSBcIl5cIikge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgc2VnbWVudCArPSBcIlxcXFxeXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGdsb2JbaSArIDFdID09IFwiOlwiKSB7XG4gICAgICAgICAgbGV0IGsgPSBpICsgMTtcbiAgICAgICAgICBsZXQgdmFsdWUgPSBcIlwiO1xuICAgICAgICAgIHdoaWxlIChnbG9iW2sgKyAxXSAhPSBudWxsICYmIGdsb2JbayArIDFdICE9IFwiOlwiKSB7XG4gICAgICAgICAgICB2YWx1ZSArPSBnbG9iW2sgKyAxXTtcbiAgICAgICAgICAgIGsrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGdsb2JbayArIDFdID09IFwiOlwiICYmIGdsb2JbayArIDJdID09IFwiXVwiKSB7XG4gICAgICAgICAgICBpID0gayArIDI7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gXCJhbG51bVwiKSBzZWdtZW50ICs9IFwiXFxcXGRBLVphLXpcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwiYWxwaGFcIikgc2VnbWVudCArPSBcIkEtWmEtelwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJhc2NpaVwiKSBzZWdtZW50ICs9IFwiXFx4MDAtXFx4N0ZcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwiYmxhbmtcIikgc2VnbWVudCArPSBcIlxcdCBcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwiY250cmxcIikgc2VnbWVudCArPSBcIlxceDAwLVxceDFGXFx4N0ZcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwiZGlnaXRcIikgc2VnbWVudCArPSBcIlxcXFxkXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImdyYXBoXCIpIHNlZ21lbnQgKz0gXCJcXHgyMS1cXHg3RVwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJsb3dlclwiKSBzZWdtZW50ICs9IFwiYS16XCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcInByaW50XCIpIHNlZ21lbnQgKz0gXCJcXHgyMC1cXHg3RVwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJwdW5jdFwiKSB7XG4gICAgICAgICAgICAgIHNlZ21lbnQgKz0gXCIhXFxcIiMkJSYnKCkqKyxcXFxcLS4vOjs8PT4/QFtcXFxcXFxcXFxcXFxdXl/igJh7fH1+XCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09IFwic3BhY2VcIikgc2VnbWVudCArPSBcIlxcXFxzXFx2XCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcInVwcGVyXCIpIHNlZ21lbnQgKz0gXCJBLVpcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwid29yZFwiKSBzZWdtZW50ICs9IFwiXFxcXHdcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwieGRpZ2l0XCIpIHNlZ21lbnQgKz0gXCJcXFxcZEEtRmEtZlwiO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwiXVwiICYmIGluUmFuZ2UpIHtcbiAgICAgICAgaW5SYW5nZSA9IGZhbHNlO1xuICAgICAgICBzZWdtZW50ICs9IFwiXVwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGluUmFuZ2UpIHtcbiAgICAgICAgaWYgKGdsb2JbaV0gPT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICBzZWdtZW50ICs9IGBcXFxcXFxcXGA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VnbWVudCArPSBnbG9iW2ldO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIGdsb2JbaV0gPT0gXCIpXCIgJiYgZ3JvdXBTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICAgIGdyb3VwU3RhY2tbZ3JvdXBTdGFjay5sZW5ndGggLSAxXSAhPSBcIkJSQUNFXCJcbiAgICAgICkge1xuICAgICAgICBzZWdtZW50ICs9IFwiKVwiO1xuICAgICAgICBjb25zdCB0eXBlID0gZ3JvdXBTdGFjay5wb3AoKSE7XG4gICAgICAgIGlmICh0eXBlID09IFwiIVwiKSB7XG4gICAgICAgICAgc2VnbWVudCArPSB3aWxkY2FyZDtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlICE9IFwiQFwiKSB7XG4gICAgICAgICAgc2VnbWVudCArPSB0eXBlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIGdsb2JbaV0gPT0gXCJ8XCIgJiYgZ3JvdXBTdGFjay5sZW5ndGggPiAwICYmXG4gICAgICAgIGdyb3VwU3RhY2tbZ3JvdXBTdGFjay5sZW5ndGggLSAxXSAhPSBcIkJSQUNFXCJcbiAgICAgICkge1xuICAgICAgICBzZWdtZW50ICs9IFwifFwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIrXCIgJiYgZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCIrXCIpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIkBcIiAmJiBleHRlbmRlZCAmJiBnbG9iW2kgKyAxXSA9PSBcIihcIikge1xuICAgICAgICBpKys7XG4gICAgICAgIGdyb3VwU3RhY2sucHVzaChcIkBcIik7XG4gICAgICAgIHNlZ21lbnQgKz0gXCIoPzpcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwiP1wiKSB7XG4gICAgICAgIGlmIChleHRlbmRlZCAmJiBnbG9iW2kgKyAxXSA9PSBcIihcIikge1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBncm91cFN0YWNrLnB1c2goXCI/XCIpO1xuICAgICAgICAgIHNlZ21lbnQgKz0gXCIoPzpcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWdtZW50ICs9IFwiLlwiO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIiFcIiAmJiBleHRlbmRlZCAmJiBnbG9iW2kgKyAxXSA9PSBcIihcIikge1xuICAgICAgICBpKys7XG4gICAgICAgIGdyb3VwU3RhY2sucHVzaChcIiFcIik7XG4gICAgICAgIHNlZ21lbnQgKz0gXCIoPyFcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwie1wiKSB7XG4gICAgICAgIGdyb3VwU3RhY2sucHVzaChcIkJSQUNFXCIpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIn1cIiAmJiBncm91cFN0YWNrW2dyb3VwU3RhY2subGVuZ3RoIC0gMV0gPT0gXCJCUkFDRVwiKSB7XG4gICAgICAgIGdyb3VwU3RhY2sucG9wKCk7XG4gICAgICAgIHNlZ21lbnQgKz0gXCIpXCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIixcIiAmJiBncm91cFN0YWNrW2dyb3VwU3RhY2subGVuZ3RoIC0gMV0gPT0gXCJCUkFDRVwiKSB7XG4gICAgICAgIHNlZ21lbnQgKz0gXCJ8XCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIipcIikge1xuICAgICAgICBpZiAoZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZ3JvdXBTdGFjay5wdXNoKFwiKlwiKTtcbiAgICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcHJldkNoYXIgPSBnbG9iW2kgLSAxXTtcbiAgICAgICAgICBsZXQgbnVtU3RhcnMgPSAxO1xuICAgICAgICAgIHdoaWxlIChnbG9iW2kgKyAxXSA9PSBcIipcIikge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgbnVtU3RhcnMrKztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgbmV4dENoYXIgPSBnbG9iW2kgKyAxXTtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBnbG9ic3Rhck9wdGlvbiAmJiBudW1TdGFycyA9PSAyICYmXG4gICAgICAgICAgICBbLi4uc2VwcywgdW5kZWZpbmVkXS5pbmNsdWRlcyhwcmV2Q2hhcikgJiZcbiAgICAgICAgICAgIFsuLi5zZXBzLCB1bmRlZmluZWRdLmluY2x1ZGVzKG5leHRDaGFyKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgc2VnbWVudCArPSBnbG9ic3RhcjtcbiAgICAgICAgICAgIGVuZHNXaXRoU2VwID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VnbWVudCArPSB3aWxkY2FyZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHNlZ21lbnQgKz0gcmVnRXhwRXNjYXBlQ2hhcnMuaW5jbHVkZXMoZ2xvYltpXSkgPyBgXFxcXCR7Z2xvYltpXX1gIDogZ2xvYltpXTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBmb3IgdW5jbG9zZWQgZ3JvdXBzIG9yIGEgZGFuZ2xpbmcgYmFja3NsYXNoLlxuICAgIGlmIChncm91cFN0YWNrLmxlbmd0aCA+IDAgfHwgaW5SYW5nZSB8fCBpbkVzY2FwZSkge1xuICAgICAgLy8gUGFyc2UgZmFpbHVyZS4gVGFrZSBhbGwgY2hhcmFjdGVycyBmcm9tIHRoaXMgc2VnbWVudCBsaXRlcmFsbHkuXG4gICAgICBzZWdtZW50ID0gXCJcIjtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBnbG9iLnNsaWNlKGosIGkpKSB7XG4gICAgICAgIHNlZ21lbnQgKz0gcmVnRXhwRXNjYXBlQ2hhcnMuaW5jbHVkZXMoYykgPyBgXFxcXCR7Y31gIDogYztcbiAgICAgICAgZW5kc1dpdGhTZXAgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZWdFeHBTdHJpbmcgKz0gc2VnbWVudDtcbiAgICBpZiAoIWVuZHNXaXRoU2VwKSB7XG4gICAgICByZWdFeHBTdHJpbmcgKz0gaSA8IGdsb2IubGVuZ3RoID8gc2VwIDogc2VwTWF5YmU7XG4gICAgICBlbmRzV2l0aFNlcCA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gVGVybWluYXRlcyB3aXRoIGBpYCBhdCB0aGUgc3RhcnQgb2YgdGhlIG5leHQgc2VnbWVudC5cbiAgICB3aGlsZSAoc2Vwcy5pbmNsdWRlcyhnbG9iW2ldKSkgaSsrO1xuXG4gICAgLy8gQ2hlY2sgdGhhdCB0aGUgbmV4dCB2YWx1ZSBvZiBgamAgaXMgaW5kZWVkIGhpZ2hlciB0aGFuIHRoZSBjdXJyZW50IHZhbHVlLlxuICAgIGlmICghKGkgPiBqKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQXNzZXJ0aW9uIGZhaWx1cmU6IGkgPiBqIChwb3RlbnRpYWwgaW5maW5pdGUgbG9vcClcIik7XG4gICAgfVxuICAgIGogPSBpO1xuICB9XG5cbiAgcmVnRXhwU3RyaW5nID0gYF4ke3JlZ0V4cFN0cmluZ30kYDtcbiAgcmV0dXJuIG5ldyBSZWdFeHAocmVnRXhwU3RyaW5nLCBjYXNlSW5zZW5zaXRpdmUgPyBcImlcIiA6IFwiXCIpO1xufVxuXG4vKiogVGVzdCB3aGV0aGVyIHRoZSBnaXZlbiBzdHJpbmcgaXMgYSBnbG9iICovXG5leHBvcnQgZnVuY3Rpb24gaXNHbG9iKHN0cjogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGNoYXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBcIntcIjogXCJ9XCIsIFwiKFwiOiBcIilcIiwgXCJbXCI6IFwiXVwiIH07XG4gIGNvbnN0IHJlZ2V4ID1cbiAgICAvXFxcXCguKXwoXiF8XFwqfFxcP3xbXFxdLispXVxcP3xcXFtbXlxcXFxcXF1dK1xcXXxcXHtbXlxcXFx9XStcXH18XFwoXFw/WzohPV1bXlxcXFwpXStcXCl8XFwoW158XStcXHxbXlxcXFwpXStcXCkpLztcblxuICBpZiAoc3RyID09PSBcIlwiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgbGV0IG1hdGNoOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXG4gIHdoaWxlICgobWF0Y2ggPSByZWdleC5leGVjKHN0cikpKSB7XG4gICAgaWYgKG1hdGNoWzJdKSByZXR1cm4gdHJ1ZTtcbiAgICBsZXQgaWR4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG5cbiAgICAvLyBpZiBhbiBvcGVuIGJyYWNrZXQvYnJhY2UvcGFyZW4gaXMgZXNjYXBlZCxcbiAgICAvLyBzZXQgdGhlIGluZGV4IHRvIHRoZSBuZXh0IGNsb3NpbmcgY2hhcmFjdGVyXG4gICAgY29uc3Qgb3BlbiA9IG1hdGNoWzFdO1xuICAgIGNvbnN0IGNsb3NlID0gb3BlbiA/IGNoYXJzW29wZW5dIDogbnVsbDtcbiAgICBpZiAob3BlbiAmJiBjbG9zZSkge1xuICAgICAgY29uc3QgbiA9IHN0ci5pbmRleE9mKGNsb3NlLCBpZHgpO1xuICAgICAgaWYgKG4gIT09IC0xKSB7XG4gICAgICAgIGlkeCA9IG4gKyAxO1xuICAgICAgfVxuICAgIH1cblxuICAgIHN0ciA9IHN0ci5zbGljZShpZHgpO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKiogTGlrZSBub3JtYWxpemUoKSwgYnV0IGRvZXNuJ3QgY29sbGFwc2UgXCIqKlxcLy4uXCIgd2hlbiBgZ2xvYnN0YXJgIGlzIHRydWUuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplR2xvYihcbiAgZ2xvYjogc3RyaW5nLFxuICB7IGdsb2JzdGFyID0gZmFsc2UgfTogR2xvYk9wdGlvbnMgPSB7fSxcbik6IHN0cmluZyB7XG4gIGlmIChnbG9iLm1hdGNoKC9cXDAvZykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEdsb2IgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzOiBcIiR7Z2xvYn1cImApO1xuICB9XG4gIGlmICghZ2xvYnN0YXIpIHtcbiAgICByZXR1cm4gbm9ybWFsaXplKGdsb2IpO1xuICB9XG4gIGNvbnN0IHMgPSBTRVBfUEFUVEVSTi5zb3VyY2U7XG4gIGNvbnN0IGJhZFBhcmVudFBhdHRlcm4gPSBuZXcgUmVnRXhwKFxuICAgIGAoPzw9KCR7c318XilcXFxcKlxcXFwqJHtzfSlcXFxcLlxcXFwuKD89JHtzfXwkKWAsXG4gICAgXCJnXCIsXG4gICk7XG4gIHJldHVybiBub3JtYWxpemUoZ2xvYi5yZXBsYWNlKGJhZFBhcmVudFBhdHRlcm4sIFwiXFwwXCIpKS5yZXBsYWNlKC9cXDAvZywgXCIuLlwiKTtcbn1cblxuLyoqIExpa2Ugam9pbigpLCBidXQgZG9lc24ndCBjb2xsYXBzZSBcIioqXFwvLi5cIiB3aGVuIGBnbG9ic3RhcmAgaXMgdHJ1ZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBqb2luR2xvYnMoXG4gIGdsb2JzOiBzdHJpbmdbXSxcbiAgeyBleHRlbmRlZCA9IHRydWUsIGdsb2JzdGFyID0gZmFsc2UgfTogR2xvYk9wdGlvbnMgPSB7fSxcbik6IHN0cmluZyB7XG4gIGlmICghZ2xvYnN0YXIgfHwgZ2xvYnMubGVuZ3RoID09IDApIHtcbiAgICByZXR1cm4gam9pbiguLi5nbG9icyk7XG4gIH1cbiAgaWYgKGdsb2JzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiLlwiO1xuICBsZXQgam9pbmVkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGZvciAoY29uc3QgZ2xvYiBvZiBnbG9icykge1xuICAgIGNvbnN0IHBhdGggPSBnbG9iO1xuICAgIGlmIChwYXRoLmxlbmd0aCA+IDApIHtcbiAgICAgIGlmICgham9pbmVkKSBqb2luZWQgPSBwYXRoO1xuICAgICAgZWxzZSBqb2luZWQgKz0gYCR7U0VQfSR7cGF0aH1gO1xuICAgIH1cbiAgfVxuICBpZiAoIWpvaW5lZCkgcmV0dXJuIFwiLlwiO1xuICByZXR1cm4gbm9ybWFsaXplR2xvYihqb2luZWQsIHsgZXh0ZW5kZWQsIGdsb2JzdGFyIH0pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckMsU0FBUyxTQUFTLEVBQUUsTUFBTSxRQUFRLGdCQUFnQixDQUFDO0FBQ25ELFNBQVMsR0FBRyxFQUFFLFdBQVcsUUFBUSxnQkFBZ0IsQ0FBQztBQUNsRCxZQUFZLE1BQU0sTUFBTSxZQUFZLENBQUM7QUFDckMsWUFBWSxNQUFNLE1BQU0sWUFBWSxDQUFDO0FBR3JDLE1BQU0sSUFBSSxHQUFHLFNBQVMsR0FBRyxNQUFNLEdBQUcsTUFBTSxBQUFDO0FBQ3pDLE1BQU0sRUFBRSxJQUFJLENBQUEsRUFBRSxTQUFTLENBQUEsRUFBRSxHQUFHLElBQUksQUFBQztBQW1CakMsTUFBTSxpQkFBaUIsR0FBRztJQUN4QixHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsSUFBSTtJQUNKLEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztDQUNKLEFBQUM7QUFDRixNQUFNLGdCQUFnQixHQUFHO0lBQUMsR0FBRztJQUFFLElBQUk7SUFBRSxHQUFHO0NBQUMsQUFBQztBQUUxQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzhEQXNEOEQsQ0FDOUQsT0FBTyxTQUFTLFlBQVksQ0FDMUIsSUFBWSxFQUNaLEVBQ0UsUUFBUSxFQUFHLElBQUksQ0FBQSxFQUNmLFFBQVEsRUFBRSxjQUFjLEdBQUcsSUFBSSxDQUFBLEVBQy9CLEVBQUUsRUFBRyxNQUFNLENBQUEsRUFDWCxlQUFlLEVBQUcsS0FBSyxDQUFBLEVBQ0gsR0FBRyxFQUFFLEVBQ25CO0lBQ1IsSUFBSSxJQUFJLElBQUksRUFBRSxFQUFFO1FBQ2Qs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