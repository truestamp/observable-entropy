// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.
import { assert } from "../_util/assert.ts";
import { basename, join, normalize } from "../path/mod.ts";
/** Create WalkEntry for the `path` synchronously */ export function _createWalkEntrySync(path) {
    path = normalize(path);
    const name = basename(path);
    const info = Deno.statSync(path);
    return {
        path,
        name,
        isFile: info.isFile,
        isDirectory: info.isDirectory,
        isSymlink: info.isSymlink
    };
}
/** Create WalkEntry for the `path` asynchronously */ export async function _createWalkEntry(path) {
    path = normalize(path);
    const name = basename(path);
    const info = await Deno.stat(path);
    return {
        path,
        name,
        isFile: info.isFile,
        isDirectory: info.isDirectory,
        isSymlink: info.isSymlink
    };
}
function include(path, exts, match, skip) {
    if (exts && !exts.some((ext)=>path.endsWith(ext))) {
        return false;
    }
    if (match && !match.some((pattern)=>!!path.match(pattern))) {
        return false;
    }
    if (skip && skip.some((pattern)=>!!path.match(pattern))) {
        return false;
    }
    return true;
}
function wrapErrorWithRootPath(err, root) {
    if (err instanceof Error && "root" in err) return err;
    const e = new Error();
    e.root = root;
    e.message = err instanceof Error ? `${err.message} for path "${root}"` : `[non-error thrown] for path "${root}"`;
    e.stack = err instanceof Error ? err.stack : undefined;
    e.cause = err instanceof Error ? err.cause : undefined;
    return e;
}
/** Walks the file tree rooted at root, yielding each file or directory in the
 * tree filtered according to the given options. The files are walked in lexical
 * order, which makes the output deterministic but means that for very large
 * directories walk() can be inefficient.
 *
 * Options:
 * - maxDepth?: number = Infinity;
 * - includeFiles?: boolean = true;
 * - includeDirs?: boolean = true;
 * - followSymlinks?: boolean = false;
 * - exts?: string[];
 * - match?: RegExp[];
 * - skip?: RegExp[];
 *
 * ```ts
 *       import { walk } from "./walk.ts";
 *       import { assert } from "../testing/asserts.ts";
 *
 *       for await (const entry of walk(".")) {
 *         console.log(entry.path);
 *         assert(entry.isFile);
 *       }
 * ```
 */ export async function* walk(root, { maxDepth =Infinity , includeFiles =true , includeDirs =true , followSymlinks =false , exts =undefined , match =undefined , skip =undefined  } = {}) {
    if (maxDepth < 0) {
        return;
    }
    if (includeDirs && include(root, exts, match, skip)) {
        yield await _createWalkEntry(root);
    }
    if (maxDepth < 1 || !include(root, undefined, undefined, skip)) {
        return;
    }
    try {
        for await (const entry of Deno.readDir(root)){
            assert(entry.name != null);
            let path = join(root, entry.name);
            let { isSymlink , isDirectory  } = entry;
            if (isSymlink) {
                if (!followSymlinks) continue;
                path = await Deno.realPath(path);
                // Caveat emptor: don't assume |path| is not a symlink. realpath()
                // resolves symlinks but another process can replace the file system
                // entity with a different type of entity before we call lstat().
                ({ isSymlink , isDirectory  } = await Deno.lstat(path));
            }
            if (isSymlink || isDirectory) {
                yield* walk(path, {
                    maxDepth: maxDepth - 1,
                    includeFiles,
                    includeDirs,
                    followSymlinks,
                    exts,
                    match,
                    skip
                });
            } else if (includeFiles && include(path, exts, match, skip)) {
                yield {
                    path,
                    ...entry
                };
            }
        }
    } catch (err) {
        throw wrapErrorWithRootPath(err, normalize(root));
    }
}
/** Same as walk() but uses synchronous ops */ export function* walkSync(root, { maxDepth =Infinity , includeFiles =true , includeDirs =true , followSymlinks =false , exts =undefined , match =undefined , skip =undefined  } = {}) {
    if (maxDepth < 0) {
        return;
    }
    if (includeDirs && include(root, exts, match, skip)) {
        yield _createWalkEntrySync(root);
    }
    if (maxDepth < 1 || !include(root, undefined, undefined, skip)) {
        return;
    }
    let entries;
    try {
        entries = Deno.readDirSync(root);
    } catch (err) {
        throw wrapErrorWithRootPath(err, normalize(root));
    }
    for (const entry of entries){
        assert(entry.name != null);
        let path = join(root, entry.name);
        let { isSymlink , isDirectory  } = entry;
        if (isSymlink) {
            if (!followSymlinks) continue;
            path = Deno.realPathSync(path);
            // Caveat emptor: don't assume |path| is not a symlink. realpath()
            // resolves symlinks but another process can replace the file system
            // entity with a different type of entity before we call lstat().
            ({ isSymlink , isDirectory  } = Deno.lstatSync(path));
        }
        if (isSymlink || isDirectory) {
            yield* walkSync(path, {
                maxDepth: maxDepth - 1,
                includeFiles,
                includeDirs,
                followSymlinks,
                exts,
                match,
                skip
            });
        } else if (includeFiles && include(path, exts, match, skip)) {
            yield {
                path,
                ...entry
            };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL2ZzL3dhbGsudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIERvY3VtZW50YXRpb24gYW5kIGludGVyZmFjZSBmb3Igd2FsayB3ZXJlIGFkYXB0ZWQgZnJvbSBHb1xuLy8gaHR0cHM6Ly9nb2xhbmcub3JnL3BrZy9wYXRoL2ZpbGVwYXRoLyNXYWxrXG4vLyBDb3B5cmlnaHQgMjAwOSBUaGUgR28gQXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gQlNEIGxpY2Vuc2UuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5pbXBvcnQgeyBiYXNlbmFtZSwgam9pbiwgbm9ybWFsaXplIH0gZnJvbSBcIi4uL3BhdGgvbW9kLnRzXCI7XG5cbi8qKiBDcmVhdGUgV2Fsa0VudHJ5IGZvciB0aGUgYHBhdGhgIHN5bmNocm9ub3VzbHkgKi9cbmV4cG9ydCBmdW5jdGlvbiBfY3JlYXRlV2Fsa0VudHJ5U3luYyhwYXRoOiBzdHJpbmcpOiBXYWxrRW50cnkge1xuICBwYXRoID0gbm9ybWFsaXplKHBhdGgpO1xuICBjb25zdCBuYW1lID0gYmFzZW5hbWUocGF0aCk7XG4gIGNvbnN0IGluZm8gPSBEZW5vLnN0YXRTeW5jKHBhdGgpO1xuICByZXR1cm4ge1xuICAgIHBhdGgsXG4gICAgbmFtZSxcbiAgICBpc0ZpbGU6IGluZm8uaXNGaWxlLFxuICAgIGlzRGlyZWN0b3J5OiBpbmZvLmlzRGlyZWN0b3J5LFxuICAgIGlzU3ltbGluazogaW5mby5pc1N5bWxpbmssXG4gIH07XG59XG5cbi8qKiBDcmVhdGUgV2Fsa0VudHJ5IGZvciB0aGUgYHBhdGhgIGFzeW5jaHJvbm91c2x5ICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX2NyZWF0ZVdhbGtFbnRyeShwYXRoOiBzdHJpbmcpOiBQcm9taXNlPFdhbGtFbnRyeT4ge1xuICBwYXRoID0gbm9ybWFsaXplKHBhdGgpO1xuICBjb25zdCBuYW1lID0gYmFzZW5hbWUocGF0aCk7XG4gIGNvbnN0IGluZm8gPSBhd2FpdCBEZW5vLnN0YXQocGF0aCk7XG4gIHJldHVybiB7XG4gICAgcGF0aCxcbiAgICBuYW1lLFxuICAgIGlzRmlsZTogaW5mby5pc0ZpbGUsXG4gICAgaXNEaXJlY3Rvcnk6IGluZm8uaXNEaXJlY3RvcnksXG4gICAgaXNTeW1saW5rOiBpbmZvLmlzU3ltbGluayxcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXYWxrT3B0aW9ucyB7XG4gIG1heERlcHRoPzogbnVtYmVyO1xuICBpbmNsdWRlRmlsZXM/OiBib29sZWFuO1xuICBpbmNsdWRlRGlycz86IGJvb2xlYW47XG4gIGZvbGxvd1N5bWxpbmtzPzogYm9vbGVhbjtcbiAgZXh0cz86IHN0cmluZ1tdO1xuICBtYXRjaD86IFJlZ0V4cFtdO1xuICBza2lwPzogUmVnRXhwW107XG59XG5cbmZ1bmN0aW9uIGluY2x1ZGUoXG4gIHBhdGg6IHN0cmluZyxcbiAgZXh0cz86IHN0cmluZ1tdLFxuICBtYXRjaD86IFJlZ0V4cFtdLFxuICBza2lwPzogUmVnRXhwW10sXG4pOiBib29sZWFuIHtcbiAgaWYgKGV4dHMgJiYgIWV4dHMuc29tZSgoZXh0KTogYm9vbGVhbiA9PiBwYXRoLmVuZHNXaXRoKGV4dCkpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChtYXRjaCAmJiAhbWF0Y2guc29tZSgocGF0dGVybik6IGJvb2xlYW4gPT4gISFwYXRoLm1hdGNoKHBhdHRlcm4pKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoc2tpcCAmJiBza2lwLnNvbWUoKHBhdHRlcm4pOiBib29sZWFuID0+ICEhcGF0aC5tYXRjaChwYXR0ZXJuKSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHdyYXBFcnJvcldpdGhSb290UGF0aChlcnI6IHVua25vd24sIHJvb3Q6IHN0cmluZykge1xuICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IgJiYgXCJyb290XCIgaW4gZXJyKSByZXR1cm4gZXJyO1xuICBjb25zdCBlID0gbmV3IEVycm9yKCkgYXMgRXJyb3IgJiB7IHJvb3Q6IHN0cmluZyB9O1xuICBlLnJvb3QgPSByb290O1xuICBlLm1lc3NhZ2UgPSBlcnIgaW5zdGFuY2VvZiBFcnJvclxuICAgID8gYCR7ZXJyLm1lc3NhZ2V9IGZvciBwYXRoIFwiJHtyb290fVwiYFxuICAgIDogYFtub24tZXJyb3IgdGhyb3duXSBmb3IgcGF0aCBcIiR7cm9vdH1cImA7XG4gIGUuc3RhY2sgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5zdGFjayA6IHVuZGVmaW5lZDtcbiAgZS5jYXVzZSA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLmNhdXNlIDogdW5kZWZpbmVkO1xuICByZXR1cm4gZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXYWxrRW50cnkgZXh0ZW5kcyBEZW5vLkRpckVudHJ5IHtcbiAgcGF0aDogc3RyaW5nO1xufVxuXG4vKiogV2Fsa3MgdGhlIGZpbGUgdHJlZSByb290ZWQgYXQgcm9vdCwgeWllbGRpbmcgZWFjaCBmaWxlIG9yIGRpcmVjdG9yeSBpbiB0aGVcbiAqIHRyZWUgZmlsdGVyZWQgYWNjb3JkaW5nIHRvIHRoZSBnaXZlbiBvcHRpb25zLiBUaGUgZmlsZXMgYXJlIHdhbGtlZCBpbiBsZXhpY2FsXG4gKiBvcmRlciwgd2hpY2ggbWFrZXMgdGhlIG91dHB1dCBkZXRlcm1pbmlzdGljIGJ1dCBtZWFucyB0aGF0IGZvciB2ZXJ5IGxhcmdlXG4gKiBkaXJlY3RvcmllcyB3YWxrKCkgY2FuIGJlIGluZWZmaWNpZW50LlxuICpcbiAqIE9wdGlvbnM6XG4gKiAtIG1heERlcHRoPzogbnVtYmVyID0gSW5maW5pdHk7XG4gKiAtIGluY2x1ZGVGaWxlcz86IGJvb2xlYW4gPSB0cnVlO1xuICogLSBpbmNsdWRlRGlycz86IGJvb2xlYW4gPSB0cnVlO1xuICogLSBmb2xsb3dTeW1saW5rcz86IGJvb2xlYW4gPSBmYWxzZTtcbiAqIC0gZXh0cz86IHN0cmluZ1tdO1xuICogLSBtYXRjaD86IFJlZ0V4cFtdO1xuICogLSBza2lwPzogUmVnRXhwW107XG4gKlxuICogYGBgdHNcbiAqICAgICAgIGltcG9ydCB7IHdhbGsgfSBmcm9tIFwiLi93YWxrLnRzXCI7XG4gKiAgICAgICBpbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vdGVzdGluZy9hc3NlcnRzLnRzXCI7XG4gKlxuICogICAgICAgZm9yIGF3YWl0IChjb25zdCBlbnRyeSBvZiB3YWxrKFwiLlwiKSkge1xuICogICAgICAgICBjb25zb2xlLmxvZyhlbnRyeS5wYXRoKTtcbiAqICAgICAgICAgYXNzZXJ0KGVudHJ5LmlzRmlsZSk7XG4gKiAgICAgICB9XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiB3YWxrKFxuICByb290OiBzdHJpbmcsXG4gIHtcbiAgICBtYXhEZXB0aCA9IEluZmluaXR5LFxuICAgIGluY2x1ZGVGaWxlcyA9IHRydWUsXG4gICAgaW5jbHVkZURpcnMgPSB0cnVlLFxuICAgIGZvbGxvd1N5bWxpbmtzID0gZmFsc2UsXG4gICAgZXh0cyA9IHVuZGVmaW5lZCxcbiAgICBtYXRjaCA9IHVuZGVmaW5lZCxcbiAgICBza2lwID0gdW5kZWZpbmVkLFxuICB9OiBXYWxrT3B0aW9ucyA9IHt9LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFdhbGtFbnRyeT4ge1xuICBpZiAobWF4RGVwdGggPCAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChpbmNsdWRlRGlycyAmJiBpbmNsdWRlKHJvb3QsIGV4dHMsIG1hdGNoLCBza2lwKSkge1xuICAgIHlpZWxkIGF3YWl0IF9jcmVhdGVXYWxrRW50cnkocm9vdCk7XG4gIH1cbiAgaWYgKG1heERlcHRoIDwgMSB8fCAhaW5jbHVkZShyb290LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgc2tpcCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIERlbm8ucmVhZERpcihyb290KSkge1xuICAgICAgYXNzZXJ0KGVudHJ5Lm5hbWUgIT0gbnVsbCk7XG4gICAgICBsZXQgcGF0aCA9IGpvaW4ocm9vdCwgZW50cnkubmFtZSk7XG5cbiAgICAgIGxldCB7IGlzU3ltbGluaywgaXNEaXJlY3RvcnkgfSA9IGVudHJ5O1xuXG4gICAgICBpZiAoaXNTeW1saW5rKSB7XG4gICAgICAgIGlmICghZm9sbG93U3ltbGlua3MpIGNvbnRpbnVlO1xuICAgICAgICBwYXRoID0gYXdhaXQgRGVuby5yZWFsUGF0aChwYXRoKTtcbiAgICAgICAgLy8gQ2F2ZWF0IGVtcHRvcjogZG9uJ3QgYXNzdW1lIHxwYXRofCBpcyBub3QgYSBzeW1saW5rLiByZWFscGF0aCgpXG4gICAgICAgIC8vIHJlc29sdmVzIHN5bWxpbmtzIGJ1dCBhbm90aGVyIHByb2Nlc3MgY2FuIHJlcGxhY2UgdGhlIGZpbGUgc3lzdGVtXG4gICAgICAgIC8vIGVudGl0eSB3aXRoIGEgZGlmZmVyZW50IHR5cGUgb2YgZW50aXR5IGJlZm9yZSB3ZSBjYWxsIGxzdGF0KCkuXG4gICAgICAgICh7IGlzU3ltbGluaywgaXNEaXJlY3RvcnkgfSA9IGF3YWl0IERlbm8ubHN0YXQocGF0aCkpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNTeW1saW5rIHx8IGlzRGlyZWN0b3J5KSB7XG4gICAgICAgIHlpZWxkKiB3YWxrKHBhdGgsIHtcbiAgICAgICAgICBtYXhEZXB0aDogbWF4RGVwdGggLSAxLFxuICAgICAgICAgIGluY2x1ZGVGaWxlcyxcbiAgICAgICAgICBpbmNsdWRlRGlycyxcbiAgICAgICAgICBmb2xsb3dTeW1saW5rcyxcbiAgICAgICAgICBleHRzLFxuICAgICAgICAgIG1hdGNoLFxuICAgICAgICAgIHNraXAsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRmlsZXMgJiYgaW5jbHVkZShwYXRoLCBleHRzLCBtYXRjaCwgc2tpcCkpIHtcbiAgICAgICAgeWllbGQgeyBwYXRoLCAuLi5lbnRyeSB9O1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgdGhyb3cgd3JhcEVycm9yV2l0aFJvb3RQYXRoKGVyciwgbm9ybWFsaXplKHJvb3QpKTtcbiAgfVxufVxuXG4vKiogU2FtZSBhcyB3YWxrKCkgYnV0IHVzZXMgc3luY2hyb25vdXMgb3BzICovXG5leHBvcnQgZnVuY3Rpb24qIHdhbGtTeW5jKFxuICByb290OiBzdHJpbmcsXG4gIHtcbiAgICBtYXhEZXB0aCA9IEluZmluaXR5LFxuICAgIGluY2x1ZGVGaWxlcyA9IHRydWUsXG4gICAgaW5jbHVkZURpcnMgPSB0cnVlLFxuICAgIGZvbGxvd1N5bWxpbmtzID0gZmFsc2UsXG4gICAgZXh0cyA9IHVuZGVmaW5lZCxcbiAgICBtYXRjaCA9IHVuZGVmaW5lZCxcbiAgICBza2lwID0gdW5kZWZpbmVkLFxuICB9OiBXYWxrT3B0aW9ucyA9IHt9LFxuKTogSXRlcmFibGVJdGVyYXRvcjxXYWxrRW50cnk+IHtcbiAgaWYgKG1heERlcHRoIDwgMCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoaW5jbHVkZURpcnMgJiYgaW5jbHVkZShyb290LCBleHRzLCBtYXRjaCwgc2tpcCkpIHtcbiAgICB5aWVsZCBfY3JlYXRlV2Fsa0VudHJ5U3luYyhyb290KTtcbiAgfVxuICBpZiAobWF4RGVwdGggPCAxIHx8ICFpbmNsdWRlKHJvb3QsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBza2lwKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBsZXQgZW50cmllcztcbiAgdHJ5IHtcbiAgICBlbnRyaWVzID0gRGVuby5yZWFkRGlyU3luYyhyb290KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgdGhyb3cgd3JhcEVycm9yV2l0aFJvb3RQYXRoKGVyciwgbm9ybWFsaXplKHJvb3QpKTtcbiAgfVxuICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICBhc3NlcnQoZW50cnkubmFtZSAhPSBudWxsKTtcbiAgICBsZXQgcGF0aCA9IGpvaW4ocm9vdCwgZW50cnkubmFtZSk7XG5cbiAgICBsZXQgeyBpc1N5bWxpbmssIGlzRGlyZWN0b3J5IH0gPSBlbnRyeTtcblxuICAgIGlmIChpc1N5bWxpbmspIHtcbiAgICAgIGlmICghZm9sbG93U3ltbGlua3MpIGNvbnRpbnVlO1xuICAgICAgcGF0aCA9IERlbm8ucmVhbFBhdGhTeW5jKHBhdGgpO1xuICAgICAgLy8gQ2F2ZWF0IGVtcHRvcjogZG9uJ3QgYXNzdW1lIHxwYXRofCBpcyBub3QgYSBzeW1saW5rLiByZWFscGF0aCgpXG4gICAgICAvLyByZXNvbHZlcyBzeW1saW5rcyBidXQgYW5vdGhlciBwcm9jZXNzIGNhbiByZXBsYWNlIHRoZSBmaWxlIHN5c3RlbVxuICAgICAgLy8gZW50aXR5IHdpdGggYSBkaWZmZXJlbnQgdHlwZSBvZiBlbnRpdHkgYmVmb3JlIHdlIGNhbGwgbHN0YXQoKS5cbiAgICAgICh7IGlzU3ltbGluaywgaXNEaXJlY3RvcnkgfSA9IERlbm8ubHN0YXRTeW5jKHBhdGgpKTtcbiAgICB9XG5cbiAgICBpZiAoaXNTeW1saW5rIHx8IGlzRGlyZWN0b3J5KSB7XG4gICAgICB5aWVsZCogd2Fsa1N5bmMocGF0aCwge1xuICAgICAgICBtYXhEZXB0aDogbWF4RGVwdGggLSAxLFxuICAgICAgICBpbmNsdWRlRmlsZXMsXG4gICAgICAgIGluY2x1ZGVEaXJzLFxuICAgICAgICBmb2xsb3dTeW1saW5rcyxcbiAgICAgICAgZXh0cyxcbiAgICAgICAgbWF0Y2gsXG4gICAgICAgIHNraXAsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGluY2x1ZGVGaWxlcyAmJiBpbmNsdWRlKHBhdGgsIGV4dHMsIG1hdGNoLCBza2lwKSkge1xuICAgICAgeWllbGQgeyBwYXRoLCAuLi5lbnRyeSB9O1xuICAgIH1cbiAgfVxufVxuIl0sIm5h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