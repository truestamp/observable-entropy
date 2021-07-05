import { exists, existsSync } from "./exists.ts";
import { isSubdir } from "./_util.ts";
export async function move(src, dest, { overwrite = false } = {}) {
    const srcStat = await Deno.stat(src);
    if (srcStat.isDirectory && isSubdir(src, dest)) {
        throw new Error(`Cannot move '${src}' to a subdirectory of itself, '${dest}'.`);
    }
    if (overwrite) {
        if (await exists(dest)) {
            await Deno.remove(dest, { recursive: true });
        }
    }
    else {
        if (await exists(dest)) {
            throw new Error("dest already exists.");
        }
    }
    await Deno.rename(src, dest);
    return;
}
export function moveSync(src, dest, { overwrite = false } = {}) {
    const srcStat = Deno.statSync(src);
    if (srcStat.isDirectory && isSubdir(src, dest)) {
        throw new Error(`Cannot move '${src}' to a subdirectory of itself, '${dest}'.`);
    }
    if (overwrite) {
        if (existsSync(dest)) {
            Deno.removeSync(dest, { recursive: true });
        }
    }
    else {
        if (existsSync(dest)) {
            throw new Error("dest already exists.");
        }
    }
    Deno.renameSync(src, dest);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW92ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDakQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFlBQVksQ0FBQztBQU90QyxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FDeEIsR0FBVyxFQUNYLElBQVksRUFDWixFQUFFLFNBQVMsR0FBRyxLQUFLLEtBQWtCLEVBQUU7SUFFdkMsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXJDLElBQUksT0FBTyxDQUFDLFdBQVcsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFO1FBQzlDLE1BQU0sSUFBSSxLQUFLLENBQ2IsZ0JBQWdCLEdBQUcsbUNBQW1DLElBQUksSUFBSSxDQUMvRCxDQUFDO0tBQ0g7SUFFRCxJQUFJLFNBQVMsRUFBRTtRQUNiLElBQUksTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdEIsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzlDO0tBQ0Y7U0FBTTtRQUNMLElBQUksTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3pDO0tBQ0Y7SUFFRCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRTdCLE9BQU87QUFDVCxDQUFDO0FBR0QsTUFBTSxVQUFVLFFBQVEsQ0FDdEIsR0FBVyxFQUNYLElBQVksRUFDWixFQUFFLFNBQVMsR0FBRyxLQUFLLEtBQWtCLEVBQUU7SUFFdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUVuQyxJQUFJLE9BQU8sQ0FBQyxXQUFXLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsRUFBRTtRQUM5QyxNQUFNLElBQUksS0FBSyxDQUNiLGdCQUFnQixHQUFHLG1DQUFtQyxJQUFJLElBQUksQ0FDL0QsQ0FBQztLQUNIO0lBRUQsSUFBSSxTQUFTLEVBQUU7UUFDYixJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzVDO0tBQ0Y7U0FBTTtRQUNMLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztTQUN6QztLQUNGO0lBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDN0IsQ0FBQyJ9