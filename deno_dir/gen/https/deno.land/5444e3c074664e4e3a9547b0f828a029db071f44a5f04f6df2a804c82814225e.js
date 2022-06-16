// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module provides an interface to `Deno.core`. For environments
// that don't have access to `Deno.core` some APIs are polyfilled, while
// some are unavailble and throw on call.
// deno-lint-ignore no-explicit-any
export let core;
// @ts-ignore Deno.core is not defined in types
if (Deno?.core) {
    // @ts-ignore Deno.core is not defined in types
    core = Deno.core;
} else {
    core = {
        setNextTickCallback: undefined,
        evalContext (_code, _filename) {
            throw new Error("Deno.core.evalContext is not supported in this environment");
        },
        encode (chunk) {
            return new TextEncoder().encode(chunk);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvX2NvcmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLy8gVGhpcyBtb2R1bGUgcHJvdmlkZXMgYW4gaW50ZXJmYWNlIHRvIGBEZW5vLmNvcmVgLiBGb3IgZW52aXJvbm1lbnRzXG4vLyB0aGF0IGRvbid0IGhhdmUgYWNjZXNzIHRvIGBEZW5vLmNvcmVgIHNvbWUgQVBJcyBhcmUgcG9seWZpbGxlZCwgd2hpbGVcbi8vIHNvbWUgYXJlIHVuYXZhaWxibGUgYW5kIHRocm93IG9uIGNhbGwuXG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5leHBvcnQgbGV0IGNvcmU6IGFueTtcblxuLy8gQHRzLWlnbm9yZSBEZW5vLmNvcmUgaXMgbm90IGRlZmluZWQgaW4gdHlwZXNcbmlmIChEZW5vPy5jb3JlKSB7XG4gIC8vIEB0cy1pZ25vcmUgRGVuby5jb3JlIGlzIG5vdCBkZWZpbmVkIGluIHR5cGVzXG4gIGNvcmUgPSBEZW5vLmNvcmU7XG59IGVsc2Uge1xuICBjb3JlID0ge1xuICAgIHNldE5leHRUaWNrQ2FsbGJhY2s6IHVuZGVmaW5lZCxcbiAgICBldmFsQ29udGV4dChfY29kZTogc3RyaW5nLCBfZmlsZW5hbWU6IHN0cmluZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkRlbm8uY29yZS5ldmFsQ29udGV4dCBpcyBub3Qgc3VwcG9ydGVkIGluIHRoaXMgZW52aXJvbm1lbnRcIixcbiAgICAgICk7XG4gICAgfSxcbiAgICBlbmNvZGUoY2h1bms6IHN0cmluZyk6IFVpbnQ4QXJyYXkge1xuICAgICAgcmV0dXJuIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShjaHVuayk7XG4gICAgfSxcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFFMUUscUVBQXFFO0FBQ3JFLHdFQUF3RTtBQUN4RSx5Q0FBeUM7QUFFekMsbUNBQW1DO0FBQ25DLE9BQU8sSUFBSSxJQUFJLEFBQUssQ0FBQztBQUVyQiwrQ0FBK0M7QUFDL0MsSUFBSSxJQUFJLEVBQUUsSUFBSSxFQUFFO0lBQ2QsK0NBQStDO0lBQy9DLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0NBQ2xCLE1BQU07SUFDTCxJQUFJLEdBQUc7UUFDTCxtQkFBbUIsRUFBRSxTQUFTO1FBQzlCLFdBQVcsRUFBQyxLQUFhLEVBQUUsU0FBaUIsRUFBRTtZQUM1QyxNQUFNLElBQUksS0FBSyxDQUNiLDREQUE0RCxDQUM3RCxDQUFDO1NBQ0g7UUFDRCxNQUFNLEVBQUMsS0FBYSxFQUFjO1lBQ2hDLE9BQU8sSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDeEM7S0FDRixDQUFDO0NBQ0gifQ==