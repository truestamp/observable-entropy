import { CHAR_BACKWARD_SLASH, CHAR_DOT, CHAR_FORWARD_SLASH, CHAR_LOWERCASE_A, CHAR_LOWERCASE_Z, CHAR_UPPERCASE_A, CHAR_UPPERCASE_Z, } from "./_constants.ts";
export function assertPath(path) {
    if (typeof path !== "string") {
        throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
    }
}
export function isPosixPathSeparator(code) {
    return code === CHAR_FORWARD_SLASH;
}
export function isPathSeparator(code) {
    return isPosixPathSeparator(code) || code === CHAR_BACKWARD_SLASH;
}
export function isWindowsDeviceRoot(code) {
    return ((code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z) ||
        (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z));
}
export function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code;
    for (let i = 0, len = path.length; i <= len; ++i) {
        if (i < len)
            code = path.charCodeAt(i);
        else if (isPathSeparator(code))
            break;
        else
            code = CHAR_FORWARD_SLASH;
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) {
            }
            else if (lastSlash !== i - 1 && dots === 2) {
                if (res.length < 2 ||
                    lastSegmentLength !== 2 ||
                    res.charCodeAt(res.length - 1) !== CHAR_DOT ||
                    res.charCodeAt(res.length - 2) !== CHAR_DOT) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.lastIndexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = "";
                            lastSegmentLength = 0;
                        }
                        else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                    else if (res.length === 2 || res.length === 1) {
                        res = "";
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    if (res.length > 0)
                        res += `${separator}..`;
                    else
                        res = "..";
                    lastSegmentLength = 2;
                }
            }
            else {
                if (res.length > 0)
                    res += separator + path.slice(lastSlash + 1, i);
                else
                    res = path.slice(lastSlash + 1, i);
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        }
        else if (code === CHAR_DOT && dots !== -1) {
            ++dots;
        }
        else {
            dots = -1;
        }
    }
    return res;
}
export function _format(sep, pathObject) {
    const dir = pathObject.dir || pathObject.root;
    const base = pathObject.base ||
        (pathObject.name || "") + (pathObject.ext || "");
    if (!dir)
        return base;
    if (dir === pathObject.root)
        return dir + base;
    return dir + sep + base;
}
const WHITESPACE_ENCODINGS = {
    "\u0009": "%09",
    "\u000A": "%0A",
    "\u000B": "%0B",
    "\u000C": "%0C",
    "\u000D": "%0D",
    "\u0020": "%20",
};
export function encodeWhitespace(string) {
    return string.replaceAll(/[\s]/g, (c) => {
        return WHITESPACE_ENCODINGS[c] ?? c;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX3V0aWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJfdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFLQSxPQUFPLEVBQ0wsbUJBQW1CLEVBQ25CLFFBQVEsRUFDUixrQkFBa0IsRUFDbEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsZ0JBQWdCLEdBQ2pCLE1BQU0saUJBQWlCLENBQUM7QUFFekIsTUFBTSxVQUFVLFVBQVUsQ0FBQyxJQUFZO0lBQ3JDLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO1FBQzVCLE1BQU0sSUFBSSxTQUFTLENBQ2pCLG1DQUFtQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQzFELENBQUM7S0FDSDtBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsSUFBWTtJQUMvQyxPQUFPLElBQUksS0FBSyxrQkFBa0IsQ0FBQztBQUNyQyxDQUFDO0FBRUQsTUFBTSxVQUFVLGVBQWUsQ0FBQyxJQUFZO0lBQzFDLE9BQU8sb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxLQUFLLG1CQUFtQixDQUFDO0FBQ3BFLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsSUFBWTtJQUM5QyxPQUFPLENBQ0wsQ0FBQyxJQUFJLElBQUksZ0JBQWdCLElBQUksSUFBSSxJQUFJLGdCQUFnQixDQUFDO1FBQ3RELENBQUMsSUFBSSxJQUFJLGdCQUFnQixJQUFJLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxDQUN2RCxDQUFDO0FBQ0osQ0FBQztBQUdELE1BQU0sVUFBVSxlQUFlLENBQzdCLElBQVksRUFDWixjQUF1QixFQUN2QixTQUFpQixFQUNqQixlQUEwQztJQUUxQyxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDYixJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztJQUMxQixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNuQixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7SUFDYixJQUFJLElBQXdCLENBQUM7SUFDN0IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRTtRQUNoRCxJQUFJLENBQUMsR0FBRyxHQUFHO1lBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbEMsSUFBSSxlQUFlLENBQUMsSUFBSyxDQUFDO1lBQUUsTUFBTTs7WUFDbEMsSUFBSSxHQUFHLGtCQUFrQixDQUFDO1FBRS9CLElBQUksZUFBZSxDQUFDLElBQUssQ0FBQyxFQUFFO1lBQzFCLElBQUksU0FBUyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTthQUV0QztpQkFBTSxJQUFJLFNBQVMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7Z0JBQzVDLElBQ0UsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDO29CQUNkLGlCQUFpQixLQUFLLENBQUM7b0JBQ3ZCLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxRQUFRO29CQUMzQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssUUFBUSxFQUMzQztvQkFDQSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO3dCQUNsQixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUNsRCxJQUFJLGNBQWMsS0FBSyxDQUFDLENBQUMsRUFBRTs0QkFDekIsR0FBRyxHQUFHLEVBQUUsQ0FBQzs0QkFDVCxpQkFBaUIsR0FBRyxDQUFDLENBQUM7eUJBQ3ZCOzZCQUFNOzRCQUNMLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQzs0QkFDbkMsaUJBQWlCLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQzt5QkFDakU7d0JBQ0QsU0FBUyxHQUFHLENBQUMsQ0FBQzt3QkFDZCxJQUFJLEdBQUcsQ0FBQyxDQUFDO3dCQUNULFNBQVM7cUJBQ1Y7eUJBQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTt3QkFDL0MsR0FBRyxHQUFHLEVBQUUsQ0FBQzt3QkFDVCxpQkFBaUIsR0FBRyxDQUFDLENBQUM7d0JBQ3RCLFNBQVMsR0FBRyxDQUFDLENBQUM7d0JBQ2QsSUFBSSxHQUFHLENBQUMsQ0FBQzt3QkFDVCxTQUFTO3FCQUNWO2lCQUNGO2dCQUNELElBQUksY0FBYyxFQUFFO29CQUNsQixJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQzt3QkFBRSxHQUFHLElBQUksR0FBRyxTQUFTLElBQUksQ0FBQzs7d0JBQ3ZDLEdBQUcsR0FBRyxJQUFJLENBQUM7b0JBQ2hCLGlCQUFpQixHQUFHLENBQUMsQ0FBQztpQkFDdkI7YUFDRjtpQkFBTTtnQkFDTCxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztvQkFBRSxHQUFHLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzs7b0JBQy9ELEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLGlCQUFpQixHQUFHLENBQUMsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2FBQ3ZDO1lBQ0QsU0FBUyxHQUFHLENBQUMsQ0FBQztZQUNkLElBQUksR0FBRyxDQUFDLENBQUM7U0FDVjthQUFNLElBQUksSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDM0MsRUFBRSxJQUFJLENBQUM7U0FDUjthQUFNO1lBQ0wsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ1g7S0FDRjtJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELE1BQU0sVUFBVSxPQUFPLENBQ3JCLEdBQVcsRUFDWCxVQUFpQztJQUVqQyxNQUFNLEdBQUcsR0FBdUIsVUFBVSxDQUFDLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDO0lBQ2xFLE1BQU0sSUFBSSxHQUFXLFVBQVUsQ0FBQyxJQUFJO1FBQ2xDLENBQUMsVUFBVSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUM7SUFDbkQsSUFBSSxDQUFDLEdBQUc7UUFBRSxPQUFPLElBQUksQ0FBQztJQUN0QixJQUFJLEdBQUcsS0FBSyxVQUFVLENBQUMsSUFBSTtRQUFFLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQztJQUMvQyxPQUFPLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQzFCLENBQUM7QUFFRCxNQUFNLG9CQUFvQixHQUEyQjtJQUNuRCxRQUFRLEVBQUUsS0FBSztJQUNmLFFBQVEsRUFBRSxLQUFLO0lBQ2YsUUFBUSxFQUFFLEtBQUs7SUFDZixRQUFRLEVBQUUsS0FBSztJQUNmLFFBQVEsRUFBRSxLQUFLO0lBQ2YsUUFBUSxFQUFFLEtBQUs7Q0FDaEIsQ0FBQztBQUVGLE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxNQUFjO0lBQzdDLE9BQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUN0QyxPQUFPLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMifQ==