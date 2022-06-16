// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { SEP } from "./separator.ts";
/** Determines the common path from a set of paths, using an optional separator,
 * which defaults to the OS default separator.
 *
 * ```ts
 *       import { common } from "https://deno.land/std@$STD_VERSION/path/mod.ts";
 *       const p = common([
 *         "./deno/std/path/mod.ts",
 *         "./deno/std/fs/mod.ts",
 *       ]);
 *       console.log(p); // "./deno/std/"
 * ```
 */ export function common(paths, sep = SEP) {
    const [first = "", ...remaining] = paths;
    if (first === "" || remaining.length === 0) {
        return first.substring(0, first.lastIndexOf(sep) + 1);
    }
    const parts = first.split(sep);
    let endOfPrefix = parts.length;
    for (const path of remaining){
        const compare = path.split(sep);
        for(let i = 0; i < endOfPrefix; i++){
            if (compare[i] !== parts[i]) {
                endOfPrefix = i;
            }
        }
        if (endOfPrefix === 0) {
            return "";
        }
    }
    const prefix = parts.slice(0, endOfPrefix).join(sep);
    return prefix.endsWith(sep) ? prefix : `${prefix}${sep}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL3BhdGgvY29tbW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmltcG9ydCB7IFNFUCB9IGZyb20gXCIuL3NlcGFyYXRvci50c1wiO1xuXG4vKiogRGV0ZXJtaW5lcyB0aGUgY29tbW9uIHBhdGggZnJvbSBhIHNldCBvZiBwYXRocywgdXNpbmcgYW4gb3B0aW9uYWwgc2VwYXJhdG9yLFxuICogd2hpY2ggZGVmYXVsdHMgdG8gdGhlIE9TIGRlZmF1bHQgc2VwYXJhdG9yLlxuICpcbiAqIGBgYHRzXG4gKiAgICAgICBpbXBvcnQgeyBjb21tb24gfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9wYXRoL21vZC50c1wiO1xuICogICAgICAgY29uc3QgcCA9IGNvbW1vbihbXG4gKiAgICAgICAgIFwiLi9kZW5vL3N0ZC9wYXRoL21vZC50c1wiLFxuICogICAgICAgICBcIi4vZGVuby9zdGQvZnMvbW9kLnRzXCIsXG4gKiAgICAgICBdKTtcbiAqICAgICAgIGNvbnNvbGUubG9nKHApOyAvLyBcIi4vZGVuby9zdGQvXCJcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tbW9uKHBhdGhzOiBzdHJpbmdbXSwgc2VwID0gU0VQKTogc3RyaW5nIHtcbiAgY29uc3QgW2ZpcnN0ID0gXCJcIiwgLi4ucmVtYWluaW5nXSA9IHBhdGhzO1xuICBpZiAoZmlyc3QgPT09IFwiXCIgfHwgcmVtYWluaW5nLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBmaXJzdC5zdWJzdHJpbmcoMCwgZmlyc3QubGFzdEluZGV4T2Yoc2VwKSArIDEpO1xuICB9XG4gIGNvbnN0IHBhcnRzID0gZmlyc3Quc3BsaXQoc2VwKTtcblxuICBsZXQgZW5kT2ZQcmVmaXggPSBwYXJ0cy5sZW5ndGg7XG4gIGZvciAoY29uc3QgcGF0aCBvZiByZW1haW5pbmcpIHtcbiAgICBjb25zdCBjb21wYXJlID0gcGF0aC5zcGxpdChzZXApO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW5kT2ZQcmVmaXg7IGkrKykge1xuICAgICAgaWYgKGNvbXBhcmVbaV0gIT09IHBhcnRzW2ldKSB7XG4gICAgICAgIGVuZE9mUHJlZml4ID0gaTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZW5kT2ZQcmVmaXggPT09IDApIHtcbiAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbiAgfVxuICBjb25zdCBwcmVmaXggPSBwYXJ0cy5zbGljZSgwLCBlbmRPZlByZWZpeCkuam9pbihzZXApO1xuICByZXR1cm4gcHJlZml4LmVuZHNXaXRoKHNlcCkgPyBwcmVmaXggOiBgJHtwcmVmaXh9JHtzZXB9YDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDLFNBQVMsR0FBRyxRQUFRLGdCQUFnQixDQUFDO0FBRXJDOzs7Ozs7Ozs7OztHQVdHLENBQ0gsT0FBTyxTQUFTLE1BQU0sQ0FBQyxLQUFlLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBVTtJQUN6RCxNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsRUFBRSxHQUFHLFNBQVMsQ0FBQyxHQUFHLEtBQUssQUFBQztJQUN6QyxJQUFJLEtBQUssS0FBSyxFQUFFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDMUMsT0FBTyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ3ZEO0lBQ0QsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQUFBQztJQUUvQixJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUMsTUFBTSxBQUFDO0lBQy9CLEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxDQUFFO1FBQzVCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEFBQUM7UUFDaEMsSUFBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBRTtZQUNwQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQzNCLFdBQVcsR0FBRyxDQUFDLENBQUM7YUFDakI7U0FDRjtRQUVELElBQUksV0FBVyxLQUFLLENBQUMsRUFBRTtZQUNyQixPQUFPLEVBQUUsQ0FBQztTQUNYO0tBQ0Y7SUFDRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEFBQUM7SUFDckQsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUMxRCJ9