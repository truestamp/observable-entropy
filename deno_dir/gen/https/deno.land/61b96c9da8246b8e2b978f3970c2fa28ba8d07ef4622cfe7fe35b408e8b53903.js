// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { join } from "../path/mod.ts";
/**
 * Ensures that a directory is empty.
 * Deletes directory contents if the directory is not empty.
 * If the directory does not exist, it is created.
 * The directory itself is not deleted.
 * Requires the `--allow-read` and `--allow-write` flag.
 */ export async function emptyDir(dir) {
    try {
        const items = [];
        for await (const dirEntry of Deno.readDir(dir)){
            items.push(dirEntry);
        }
        while(items.length){
            const item = items.shift();
            if (item && item.name) {
                const filepath = join(dir, item.name);
                await Deno.remove(filepath, {
                    recursive: true
                });
            }
        }
    } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
            throw err;
        }
        // if not exist. then create it
        await Deno.mkdir(dir, {
            recursive: true
        });
    }
}
/**
 * Ensures that a directory is empty.
 * Deletes directory contents if the directory is not empty.
 * If the directory does not exist, it is created.
 * The directory itself is not deleted.
 * Requires the `--allow-read` and `--allow-write` flag.
 */ export function emptyDirSync(dir) {
    try {
        const items = [
            ...Deno.readDirSync(dir)
        ];
        // If the directory exists, remove all entries inside it.
        while(items.length){
            const item = items.shift();
            if (item && item.name) {
                const filepath = join(dir, item.name);
                Deno.removeSync(filepath, {
                    recursive: true
                });
            }
        }
    } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
            throw err;
        }
        // if not exist. then create it
        Deno.mkdirSync(dir, {
            recursive: true
        });
        return;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL2ZzL2VtcHR5X2Rpci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgam9pbiB9IGZyb20gXCIuLi9wYXRoL21vZC50c1wiO1xuXG4vKipcbiAqIEVuc3VyZXMgdGhhdCBhIGRpcmVjdG9yeSBpcyBlbXB0eS5cbiAqIERlbGV0ZXMgZGlyZWN0b3J5IGNvbnRlbnRzIGlmIHRoZSBkaXJlY3RvcnkgaXMgbm90IGVtcHR5LlxuICogSWYgdGhlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdCwgaXQgaXMgY3JlYXRlZC5cbiAqIFRoZSBkaXJlY3RvcnkgaXRzZWxmIGlzIG5vdCBkZWxldGVkLlxuICogUmVxdWlyZXMgdGhlIGAtLWFsbG93LXJlYWRgIGFuZCBgLS1hbGxvdy13cml0ZWAgZmxhZy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVtcHR5RGlyKGRpcjogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgaXRlbXMgPSBbXTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGRpckVudHJ5IG9mIERlbm8ucmVhZERpcihkaXIpKSB7XG4gICAgICBpdGVtcy5wdXNoKGRpckVudHJ5KTtcbiAgICB9XG5cbiAgICB3aGlsZSAoaXRlbXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBpdGVtID0gaXRlbXMuc2hpZnQoKTtcbiAgICAgIGlmIChpdGVtICYmIGl0ZW0ubmFtZSkge1xuICAgICAgICBjb25zdCBmaWxlcGF0aCA9IGpvaW4oZGlyLCBpdGVtLm5hbWUpO1xuICAgICAgICBhd2FpdCBEZW5vLnJlbW92ZShmaWxlcGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RGb3VuZCkpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG5cbiAgICAvLyBpZiBub3QgZXhpc3QuIHRoZW4gY3JlYXRlIGl0XG4gICAgYXdhaXQgRGVuby5ta2RpcihkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICB9XG59XG5cbi8qKlxuICogRW5zdXJlcyB0aGF0IGEgZGlyZWN0b3J5IGlzIGVtcHR5LlxuICogRGVsZXRlcyBkaXJlY3RvcnkgY29udGVudHMgaWYgdGhlIGRpcmVjdG9yeSBpcyBub3QgZW1wdHkuXG4gKiBJZiB0aGUgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0LCBpdCBpcyBjcmVhdGVkLlxuICogVGhlIGRpcmVjdG9yeSBpdHNlbGYgaXMgbm90IGRlbGV0ZWQuXG4gKiBSZXF1aXJlcyB0aGUgYC0tYWxsb3ctcmVhZGAgYW5kIGAtLWFsbG93LXdyaXRlYCBmbGFnLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW1wdHlEaXJTeW5jKGRpcjogc3RyaW5nKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgY29uc3QgaXRlbXMgPSBbLi4uRGVuby5yZWFkRGlyU3luYyhkaXIpXTtcblxuICAgIC8vIElmIHRoZSBkaXJlY3RvcnkgZXhpc3RzLCByZW1vdmUgYWxsIGVudHJpZXMgaW5zaWRlIGl0LlxuICAgIHdoaWxlIChpdGVtcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBpdGVtcy5zaGlmdCgpO1xuICAgICAgaWYgKGl0ZW0gJiYgaXRlbS5uYW1lKSB7XG4gICAgICAgIGNvbnN0IGZpbGVwYXRoID0gam9pbihkaXIsIGl0ZW0ubmFtZSk7XG4gICAgICAgIERlbm8ucmVtb3ZlU3luYyhmaWxlcGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RGb3VuZCkpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgLy8gaWYgbm90IGV4aXN0LiB0aGVuIGNyZWF0ZSBpdFxuICAgIERlbm8ubWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgcmV0dXJuO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQVMsSUFBSSxRQUFRLGdCQUFnQixDQUFDO0FBRXRDOzs7Ozs7R0FNRyxDQUNILE9BQU8sZUFBZSxRQUFRLENBQUMsR0FBVyxFQUFFO0lBQzFDLElBQUk7UUFDRixNQUFNLEtBQUssR0FBRyxFQUFFLEFBQUM7UUFDakIsV0FBVyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFFO1lBQzlDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDdEI7UUFFRCxNQUFPLEtBQUssQ0FBQyxNQUFNLENBQUU7WUFDbkIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxBQUFDO1lBQzNCLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ3JCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxBQUFDO2dCQUN0QyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO29CQUFFLFNBQVMsRUFBRSxJQUFJO2lCQUFFLENBQUMsQ0FBQzthQUNsRDtTQUNGO0tBQ0YsQ0FBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLElBQUksQ0FBQyxDQUFDLEdBQUcsWUFBWSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzFDLE1BQU0sR0FBRyxDQUFDO1NBQ1g7UUFFRCwrQkFBK0I7UUFDL0IsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRTtZQUFFLFNBQVMsRUFBRSxJQUFJO1NBQUUsQ0FBQyxDQUFDO0tBQzVDO0NBQ0Y7QUFFRDs7Ozs7O0dBTUcsQ0FDSCxPQUFPLFNBQVMsWUFBWSxDQUFDLEdBQVcsRUFBUTtJQUM5QyxJQUFJO1FBQ0YsTUFBTSxLQUFLLEdBQUc7ZUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztTQUFDLEFBQUM7UUFFekMseURBQXlEO1FBQ3pELE1BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBRTtZQUNuQixNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFFLEFBQUM7WUFDM0IsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtnQkFDckIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEFBQUM7Z0JBQ3RDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFO29CQUFFLFNBQVMsRUFBRSxJQUFJO2lCQUFFLENBQUMsQ0FBQzthQUNoRDtTQUNGO0tBQ0YsQ0FBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLElBQUksQ0FBQyxDQUFDLEdBQUcsWUFBWSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzFDLE1BQU0sR0FBRyxDQUFDO1NBQ1g7UUFDRCwrQkFBK0I7UUFDL0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUU7WUFBRSxTQUFTLEVBQUUsSUFBSTtTQUFFLENBQUMsQ0FBQztRQUN6QyxPQUFPO0tBQ1I7Q0FDRiJ9