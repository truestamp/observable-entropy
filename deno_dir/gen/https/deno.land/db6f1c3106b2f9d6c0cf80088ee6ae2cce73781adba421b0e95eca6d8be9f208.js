import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { getFileInfoType } from "./_util.ts";
export async function ensureFile(filePath) {
    try {
        const stat = await Deno.lstat(filePath);
        if (!stat.isFile) {
            throw new Error(`Ensure path exists, expected 'file', got '${getFileInfoType(stat)}'`);
        }
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            await ensureDir(path.dirname(filePath));
            await Deno.writeFile(filePath, new Uint8Array());
            return;
        }
        throw err;
    }
}
export function ensureFileSync(filePath) {
    try {
        const stat = Deno.lstatSync(filePath);
        if (!stat.isFile) {
            throw new Error(`Ensure path exists, expected 'file', got '${getFileInfoType(stat)}'`);
        }
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            ensureDirSync(path.dirname(filePath));
            Deno.writeFileSync(filePath, new Uint8Array());
            return;
        }
        throw err;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5zdXJlX2ZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnN1cmVfZmlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEtBQUssSUFBSSxNQUFNLGdCQUFnQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLFlBQVksQ0FBQztBQVU3QyxNQUFNLENBQUMsS0FBSyxVQUFVLFVBQVUsQ0FBQyxRQUFnQjtJQUMvQyxJQUFJO1FBRUYsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQ2IsNkNBQTZDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUN0RSxDQUFDO1NBQ0g7S0FDRjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBRVosSUFBSSxHQUFHLFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFFdkMsTUFBTSxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBRXhDLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ2pELE9BQU87U0FDUjtRQUVELE1BQU0sR0FBRyxDQUFDO0tBQ1g7QUFDSCxDQUFDO0FBVUQsTUFBTSxVQUFVLGNBQWMsQ0FBQyxRQUFnQjtJQUM3QyxJQUFJO1FBRUYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNoQixNQUFNLElBQUksS0FBSyxDQUNiLDZDQUE2QyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FDdEUsQ0FBQztTQUNIO0tBQ0Y7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUVaLElBQUksR0FBRyxZQUFZLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBRXZDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFFdEMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsSUFBSSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLE9BQU87U0FDUjtRQUNELE1BQU0sR0FBRyxDQUFDO0tBQ1g7QUFDSCxDQUFDIn0=