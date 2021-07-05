import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { getFileInfoType, isSubdir } from "./_util.ts";
import { assert } from "../_util/assert.ts";
import { isWindows } from "../_util/os.ts";
async function ensureValidCopy(src, dest, options) {
    let destStat;
    try {
        destStat = await Deno.lstat(dest);
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return;
        }
        throw err;
    }
    if (options.isFolder && !destStat.isDirectory) {
        throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
    }
    if (!options.overwrite) {
        throw new Error(`'${dest}' already exists.`);
    }
    return destStat;
}
function ensureValidCopySync(src, dest, options) {
    let destStat;
    try {
        destStat = Deno.lstatSync(dest);
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return;
        }
        throw err;
    }
    if (options.isFolder && !destStat.isDirectory) {
        throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
    }
    if (!options.overwrite) {
        throw new Error(`'${dest}' already exists.`);
    }
    return destStat;
}
async function copyFile(src, dest, options) {
    await ensureValidCopy(src, dest, options);
    await Deno.copyFile(src, dest);
    if (options.preserveTimestamps) {
        const statInfo = await Deno.stat(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        await Deno.utime(dest, statInfo.atime, statInfo.mtime);
    }
}
function copyFileSync(src, dest, options) {
    ensureValidCopySync(src, dest, options);
    Deno.copyFileSync(src, dest);
    if (options.preserveTimestamps) {
        const statInfo = Deno.statSync(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
    }
}
async function copySymLink(src, dest, options) {
    await ensureValidCopy(src, dest, options);
    const originSrcFilePath = await Deno.readLink(src);
    const type = getFileInfoType(await Deno.lstat(src));
    if (isWindows) {
        await Deno.symlink(originSrcFilePath, dest, {
            type: type === "dir" ? "dir" : "file",
        });
    }
    else {
        await Deno.symlink(originSrcFilePath, dest);
    }
    if (options.preserveTimestamps) {
        const statInfo = await Deno.lstat(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        await Deno.utime(dest, statInfo.atime, statInfo.mtime);
    }
}
function copySymlinkSync(src, dest, options) {
    ensureValidCopySync(src, dest, options);
    const originSrcFilePath = Deno.readLinkSync(src);
    const type = getFileInfoType(Deno.lstatSync(src));
    if (isWindows) {
        Deno.symlinkSync(originSrcFilePath, dest, {
            type: type === "dir" ? "dir" : "file",
        });
    }
    else {
        Deno.symlinkSync(originSrcFilePath, dest);
    }
    if (options.preserveTimestamps) {
        const statInfo = Deno.lstatSync(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
    }
}
async function copyDir(src, dest, options) {
    const destStat = await ensureValidCopy(src, dest, {
        ...options,
        isFolder: true,
    });
    if (!destStat) {
        await ensureDir(dest);
    }
    if (options.preserveTimestamps) {
        const srcStatInfo = await Deno.stat(src);
        assert(srcStatInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(srcStatInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        await Deno.utime(dest, srcStatInfo.atime, srcStatInfo.mtime);
    }
    for await (const entry of Deno.readDir(src)) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, path.basename(srcPath));
        if (entry.isSymlink) {
            await copySymLink(srcPath, destPath, options);
        }
        else if (entry.isDirectory) {
            await copyDir(srcPath, destPath, options);
        }
        else if (entry.isFile) {
            await copyFile(srcPath, destPath, options);
        }
    }
}
function copyDirSync(src, dest, options) {
    const destStat = ensureValidCopySync(src, dest, {
        ...options,
        isFolder: true,
    });
    if (!destStat) {
        ensureDirSync(dest);
    }
    if (options.preserveTimestamps) {
        const srcStatInfo = Deno.statSync(src);
        assert(srcStatInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(srcStatInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        Deno.utimeSync(dest, srcStatInfo.atime, srcStatInfo.mtime);
    }
    for (const entry of Deno.readDirSync(src)) {
        assert(entry.name != null, "file.name must be set");
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, path.basename(srcPath));
        if (entry.isSymlink) {
            copySymlinkSync(srcPath, destPath, options);
        }
        else if (entry.isDirectory) {
            copyDirSync(srcPath, destPath, options);
        }
        else if (entry.isFile) {
            copyFileSync(srcPath, destPath, options);
        }
    }
}
export async function copy(src, dest, options = {}) {
    src = path.resolve(src);
    dest = path.resolve(dest);
    if (src === dest) {
        throw new Error("Source and destination cannot be the same.");
    }
    const srcStat = await Deno.lstat(src);
    if (srcStat.isDirectory && isSubdir(src, dest)) {
        throw new Error(`Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`);
    }
    if (srcStat.isSymlink) {
        await copySymLink(src, dest, options);
    }
    else if (srcStat.isDirectory) {
        await copyDir(src, dest, options);
    }
    else if (srcStat.isFile) {
        await copyFile(src, dest, options);
    }
}
export function copySync(src, dest, options = {}) {
    src = path.resolve(src);
    dest = path.resolve(dest);
    if (src === dest) {
        throw new Error("Source and destination cannot be the same.");
    }
    const srcStat = Deno.lstatSync(src);
    if (srcStat.isDirectory && isSubdir(src, dest)) {
        throw new Error(`Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`);
    }
    if (srcStat.isSymlink) {
        copySymlinkSync(src, dest, options);
    }
    else if (srcStat.isDirectory) {
        copyDirSync(src, dest, options);
    }
    else if (srcStat.isFile) {
        copyFileSync(src, dest, options);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvcHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLElBQUksTUFBTSxnQkFBZ0IsQ0FBQztBQUN2QyxPQUFPLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNELE9BQU8sRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUF1QjNDLEtBQUssVUFBVSxlQUFlLENBQzVCLEdBQVcsRUFDWCxJQUFZLEVBQ1osT0FBNEI7SUFFNUIsSUFBSSxRQUF1QixDQUFDO0lBRTVCLElBQUk7UUFDRixRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ25DO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixJQUFJLEdBQUcsWUFBWSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUN2QyxPQUFPO1NBQ1I7UUFDRCxNQUFNLEdBQUcsQ0FBQztLQUNYO0lBRUQsSUFBSSxPQUFPLENBQUMsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRTtRQUM3QyxNQUFNLElBQUksS0FBSyxDQUNiLG1DQUFtQyxJQUFJLHFCQUFxQixHQUFHLElBQUksQ0FDcEUsQ0FBQztLQUNIO0lBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUU7UUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksbUJBQW1CLENBQUMsQ0FBQztLQUM5QztJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUMxQixHQUFXLEVBQ1gsSUFBWSxFQUNaLE9BQTRCO0lBRTVCLElBQUksUUFBdUIsQ0FBQztJ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