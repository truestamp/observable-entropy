import { isWindows } from "../_util/os.ts";
import * as _win32 from "./win32.ts";
import * as _posix from "./posix.ts";
const path = isWindows ? _win32 : _posix;
export const win32 = _win32;
export const posix = _posix;
export const { basename, delimiter, dirname, extname, format, fromFileUrl, isAbsolute, join, normalize, parse, relative, resolve, sep, toFileUrl, toNamespacedPath, } = path;
export * from "./common.ts";
export { SEP, SEP_PATTERN } from "./separator.ts";
export * from "./_interface.ts";
export * from "./glob.ts";
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUlBLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEtBQUssTUFBTSxNQUFNLFlBQVksQ0FBQztBQUNyQyxPQUFPLEtBQUssTUFBTSxNQUFNLFlBQVksQ0FBQztBQUVyQyxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBRXpDLE1BQU0sQ0FBQyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUM7QUFDNUIsTUFBTSxDQUFDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQztBQUM1QixNQUFNLENBQUMsTUFBTSxFQUNYLFFBQVEsRUFDUixTQUFTLEVBQ1QsT0FBTyxFQUNQLE9BQU8sRUFDUCxNQUFNLEVBQ04sV0FBVyxFQUNYLFVBQVUsRUFDVixJQUFJLEVBQ0osU0FBUyxFQUNULEtBQUssRUFDTCxRQUFRLEVBQ1IsT0FBTyxFQUNQLEdBQUcsRUFDSCxTQUFTLEVBQ1QsZ0JBQWdCLEdBQ2pCLEdBQUcsSUFBSSxDQUFDO0FBRVQsY0FBYyxhQUFhLENBQUM7QUFDNUIsT0FBTyxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNsRCxjQUFjLGlCQUFpQixDQUFDO0FBQ2hDLGNBQWMsV0FBVyxDQUFDIn0=