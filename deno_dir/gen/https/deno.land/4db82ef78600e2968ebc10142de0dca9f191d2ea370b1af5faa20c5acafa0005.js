import { assert } from "../_util/assert.ts";
import { basename, join, normalize } from "../path/mod.ts";
export function _createWalkEntrySync(path) {
    path = normalize(path);
    const name = basename(path);
    const info = Deno.statSync(path);
    return {
        path,
        name,
        isFile: info.isFile,
        isDirectory: info.isDirectory,
        isSymlink: info.isSymlink,
    };
}
export async function _createWalkEntry(path) {
    path = normalize(path);
    const name = basename(path);
    const info = await Deno.stat(path);
    return {
        path,
        name,
        isFile: info.isFile,
        isDirectory: info.isDirectory,
        isSymlink: info.isSymlink,
    };
}
function include(path, exts, match, skip) {
    if (exts && !exts.some((ext) => path.endsWith(ext))) {
        return false;
    }
    if (match && !match.some((pattern) => !!path.match(pattern))) {
        return false;
    }
    if (skip && skip.some((pattern) => !!path.match(pattern))) {
        return false;
    }
    return true;
}
function wrapErrorWithRootPath(err, root) {
    if (err.root)
        return err;
    err.root = root;
    err.message = `${err.message} for path "${root}"`;
    return err;
}
export async function* walk(root, { maxDepth = Infinity, includeFiles = true, includeDirs = true, followSymlinks = false, exts = undefined, match = undefined, skip = undefined, } = {}) {
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
        for await (const entry of Deno.readDir(root)) {
            assert(entry.name != null);
            let path = join(root, entry.name);
            if (entry.isSymlink) {
                if (followSymlinks) {
                    path = await Deno.realPath(path);
                }
                else {
                    continue;
                }
            }
            if (entry.isFile) {
                if (includeFiles && include(path, exts, match, skip)) {
                    yield { path, ...entry };
                }
            }
            else {
                yield* walk(path, {
                    maxDepth: maxDepth - 1,
                    includeFiles,
                    includeDirs,
                    followSymlinks,
                    exts,
                    match,
                    skip,
                });
            }
        }
    }
    catch (err) {
        throw wrapErrorWithRootPath(err, normalize(root));
    }
}
export function* walkSync(root, { maxDepth = Infinity, includeFiles = true, includeDirs = true, followSymlinks = false, exts = undefined, match = undefined, skip = undefined, } = {}) {
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
    }
    catch (err) {
        throw wrapErrorWithRootPath(err, normalize(root));
    }
    for (const entry of entries) {
        assert(entry.name != null);
        let path = join(root, entry.name);
        if (entry.isSymlink) {
            if (followSymlinks) {
                path = Deno.realPathSync(path);
            }
            else {
                continue;
            }
        }
        if (entry.isFile) {
            if (includeFiles && include(path, exts, match, skip)) {
                yield { path, ...entry };
            }
        }
        else {
            yield* walkSync(path, {
                maxDepth: maxDepth - 1,
                includeFiles,
                includeDirs,
                followSymlinks,
                exts,
                match,
                skip,
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Fsay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIndhbGsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0EsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzVDLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRzNELE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxJQUFZO0lBQy9DLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkIsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakMsT0FBTztRQUNMLElBQUk7UUFDSixJQUFJO1FBQ0osTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1FBQ25CLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztRQUM3QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7S0FDMUIsQ0FBQztBQUNKLENBQUM7QUFHRCxNQUFNLENBQUMsS0FBSyxVQUFVLGdCQUFnQixDQUFDLElBQVk7SUFDakQsSUFBSSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25DLE9BQU87UUFDTCxJQUFJO1FBQ0osSUFBSTtRQUNKLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtRQUNuQixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7UUFDN0IsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO0tBQzFCLENBQUM7QUFDSixDQUFDO0FBWUQsU0FBUyxPQUFPLENBQ2QsSUFBWSxFQUNaLElBQWUsRUFDZixLQUFnQixFQUNo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