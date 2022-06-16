// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
// The following are all the process APIs that don't depend on the stream module
// They have to be split this way to prevent a circular dependency
import { isWindows } from "../../_util/os.ts";
import { nextTick as _nextTick } from "../_next_tick.ts";
/** Returns the operating system CPU architecture for which the Deno binary was compiled */ function _arch() {
    if (Deno.build.arch == "x86_64") {
        return "x64";
    } else if (Deno.build.arch == "aarch64") {
        return "arm64";
    } else {
        throw Error("unreachable");
    }
}
/** https://nodejs.org/api/process.html#process_process_arch */ export const arch = _arch();
/** https://nodejs.org/api/process.html#process_process_chdir_directory */ export const chdir = Deno.chdir;
/** https://nodejs.org/api/process.html#process_process_cwd */ export const cwd = Deno.cwd;
/** https://nodejs.org/api/process.html#process_process_nexttick_callback_args */ export const nextTick = _nextTick;
/**
 * https://nodejs.org/api/process.html#process_process_env
 * Requires env permissions
 */ export const env = new Proxy({}, {
    get (_target, prop) {
        return Deno.env.get(String(prop));
    },
    ownKeys: ()=>Reflect.ownKeys(Deno.env.toObject()),
    getOwnPropertyDescriptor: (_target, name)=>{
        const e = Deno.env.toObject();
        if (name in Deno.env.toObject()) {
            const o = {
                enumerable: true,
                configurable: true
            };
            if (typeof name === "string") {
                // @ts-ignore we do want to set it only when name is of type string
                o.value = e[name];
            }
            return o;
        }
    },
    set (_target, prop, value) {
        Deno.env.set(String(prop), String(value));
        return value;
    }
});
/** https://nodejs.org/api/process.html#process_process_pid */ export const pid = Deno.pid;
/** https://nodejs.org/api/process.html#process_process_platform */ export const platform = isWindows ? "win32" : Deno.build.os;
/**
 * https://nodejs.org/api/process.html#process_process_version
 *
 * This value is hard coded to latest stable release of Node, as
 * some packages are checking it for compatibility. Previously
 * it pointed to Deno version, but that led to incompability
 * with some packages.
 */ export const version = "v16.11.1";
/**
 * https://nodejs.org/api/process.html#process_process_versions
 *
 * This value is hard coded to latest stable release of Node, as
 * some packages are checking it for compatibility. Previously
 * it contained only output of `Deno.version`, but that led to incompability
 * with some packages. Value of `v8` field is still taken from `Deno.version`.
 */ export const versions = {
    node: "16.11.1",
    uv: "1.42.0",
    zlib: "1.2.11",
    brotli: "1.0.9",
    ares: "1.17.2",
    modules: "93",
    nghttp2: "1.45.1",
    napi: "8",
    llhttp: "6.0.4",
    openssl: "1.1.1l",
    cldr: "39.0",
    icu: "69.1",
    tz: "2021a",
    unicode: "13.0",
    ...Deno.version
};
function hrtime(time) {
    const milli = performance.now();
    const sec = Math.floor(milli / 1000);
    const nano = Math.floor(milli * 1_000_000 - sec * 1_000_000_000);
    if (!time) {
        return [
            sec,
            nano
        ];
    }
    const [prevSec, prevNano] = time;
    return [
        sec - prevSec,
        nano - prevNano
    ];
}
hrtime.bigint = function() {
    const [sec, nano] = hrtime();
    return BigInt(sec) * 1_000_000_000n + BigInt(nano);
};
function memoryUsage() {
    return {
        ...Deno.memoryUsage(),
        arrayBuffers: 0
    };
}
memoryUsage.rss = function() {
    return memoryUsage().rss;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvX3Byb2Nlc3MvcHJvY2Vzcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgTm9kZS5qcyBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vLyBUaGUgZm9sbG93aW5nIGFyZSBhbGwgdGhlIHByb2Nlc3MgQVBJcyB0aGF0IGRvbid0IGRlcGVuZCBvbiB0aGUgc3RyZWFtIG1vZHVsZVxuLy8gVGhleSBoYXZlIHRvIGJlIHNwbGl0IHRoaXMgd2F5IHRvIHByZXZlbnQgYSBjaXJjdWxhciBkZXBlbmRlbmN5XG5cbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gXCIuLi8uLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgYXMgX25leHRUaWNrIH0gZnJvbSBcIi4uL19uZXh0X3RpY2sudHNcIjtcbmltcG9ydCB7IF9leGl0aW5nIH0gZnJvbSBcIi4vZXhpdGluZy50c1wiO1xuXG4vKiogUmV0dXJucyB0aGUgb3BlcmF0aW5nIHN5c3RlbSBDUFUgYXJjaGl0ZWN0dXJlIGZvciB3aGljaCB0aGUgRGVubyBiaW5hcnkgd2FzIGNvbXBpbGVkICovXG5mdW5jdGlvbiBfYXJjaCgpOiBzdHJpbmcge1xuICBpZiAoRGVuby5idWlsZC5hcmNoID09IFwieDg2XzY0XCIpIHtcbiAgICByZXR1cm4gXCJ4NjRcIjtcbiAgfSBlbHNlIGlmIChEZW5vLmJ1aWxkLmFyY2ggPT0gXCJhYXJjaDY0XCIpIHtcbiAgICByZXR1cm4gXCJhcm02NFwiO1xuICB9IGVsc2Uge1xuICAgIHRocm93IEVycm9yKFwidW5yZWFjaGFibGVcIik7XG4gIH1cbn1cblxuLyoqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19hcmNoICovXG5leHBvcnQgY29uc3QgYXJjaCA9IF9hcmNoKCk7XG5cbi8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfY2hkaXJfZGlyZWN0b3J5ICovXG5leHBvcnQgY29uc3QgY2hkaXIgPSBEZW5vLmNoZGlyO1xuXG4vKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX2N3ZCAqL1xuZXhwb3J0IGNvbnN0IGN3ZCA9IERlbm8uY3dkO1xuXG4vKiogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX25leHR0aWNrX2NhbGxiYWNrX2FyZ3MgKi9cbmV4cG9ydCBjb25zdCBuZXh0VGljayA9IF9uZXh0VGljaztcblxuLyoqXG4gKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfZW52XG4gKiBSZXF1aXJlcyBlbnYgcGVybWlzc2lvbnNcbiAqL1xuZXhwb3J0IGNvbnN0IGVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IG5ldyBQcm94eSh7fSwge1xuICBnZXQoX3RhcmdldCwgcHJvcCkge1xuICAgIHJldHVybiBEZW5vLmVudi5nZXQoU3RyaW5nKHByb3ApKTtcbiAgfSxcbiAgb3duS2V5czogKCkgPT4gUmVmbGVjdC5vd25LZXlzKERlbm8uZW52LnRvT2JqZWN0KCkpLFxuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I6IChfdGFyZ2V0LCBuYW1lKSA9PiB7XG4gICAgY29uc3QgZSA9IERlbm8uZW52LnRvT2JqZWN0KCk7XG4gICAgaWYgKG5hbWUgaW4gRGVuby5lbnYudG9PYmplY3QoKSkge1xuICAgICAgY29uc3QgbyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH07XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZSB3ZSBkbyB3YW50IHRvIHNldCBpdCBvbmx5IHdoZW4gbmFtZSBpcyBvZiB0eXBlIHN0cmluZ1xuICAgICAgICBvLnZhbHVlID0gZVtuYW1lXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvO1xuICAgIH1cbiAgfSxcbiAgc2V0KF90YXJnZXQsIHByb3AsIHZhbHVlKSB7XG4gICAgRGVuby5lbnYuc2V0KFN0cmluZyhwcm9wKSwgU3RyaW5nKHZhbHVlKSk7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9LFxufSk7XG5cbi8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfcGlkICovXG5leHBvcnQgY29uc3QgcGlkID0gRGVuby5waWQ7XG5cbi8qKiBodHRwczovL25vZGVqcy5vcmcvYXBpL3Byb2Nlc3MuaHRtbCNwcm9jZXNzX3Byb2Nlc3NfcGxhdGZvcm0gKi9cbmV4cG9ydCBjb25zdCBwbGF0Zm9ybSA9IGlzV2luZG93cyA/IFwid2luMzJcIiA6IERlbm8uYnVpbGQub3M7XG5cbi8qKlxuICogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX3ZlcnNpb25cbiAqXG4gKiBUaGlzIHZhbHVlIGlzIGhhcmQgY29kZWQgdG8gbGF0ZXN0IHN0YWJsZSByZWxlYXNlIG9mIE5vZGUsIGFzXG4gKiBzb21lIHBhY2thZ2VzIGFyZSBjaGVja2luZyBpdCBmb3IgY29tcGF0aWJpbGl0eS4gUHJldmlvdXNseVxuICogaXQgcG9pbnRlZCB0byBEZW5vIHZlcnNpb24sIGJ1dCB0aGF0IGxlZCB0byBpbmNvbXBhYmlsaXR5XG4gKiB3aXRoIHNvbWUgcGFja2FnZXMuXG4gKi9cbmV4cG9ydCBjb25zdCB2ZXJzaW9uID0gXCJ2MTYuMTEuMVwiO1xuXG4vKipcbiAqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc192ZXJzaW9uc1xuICpcbiAqIFRoaXMgdmFsdWUgaXMgaGFyZCBjb2RlZCB0byBsYXRlc3Qgc3RhYmxlIHJlbGVhc2Ugb2YgTm9kZSwgYXNcbiAqIHNvbWUgcGFja2FnZXMgYXJlIGNoZWNraW5nIGl0IGZvciBjb21wYXRpYmlsaXR5LiBQcmV2aW91c2x5XG4gKiBpdCBjb250YWluZWQgb25seSBvdXRwdXQgb2YgYERlbm8udmVyc2lvbmAsIGJ1dCB0aGF0IGxlZCB0byBpbmNvbXBhYmlsaXR5XG4gKiB3aXRoIHNvbWUgcGFja2FnZXMuIFZhbHVlIG9mIGB2OGAgZmllbGQgaXMgc3RpbGwgdGFrZW4gZnJvbSBgRGVuby52ZXJzaW9uYC5cbiAqL1xuZXhwb3J0IGNvbnN0IHZlcnNpb25zID0ge1xuICBub2RlOiBcIjE2LjExLjFcIixcbiAgdXY6IFwiMS40Mi4wXCIsXG4gIHpsaWI6IFwiMS4yLjExXCIsXG4gIGJyb3RsaTogXCIxLjAuOVwiLFxuICBhcmVzOiBcIjEuMTcuMlwiLFxuICBtb2R1bGVzOiBcIjkzXCIsXG4gIG5naHR0cDI6IFwiMS40NS4xXCIsXG4gIG5hcGk6IFwiOFwiLFxuICBsbGh0dHA6IFwiNi4wLjRcIixcbiAgb3BlbnNzbDogXCIxLjEuMWxcIixcbiAgY2xkcjogXCIzOS4wXCIsXG4gIGljdTogXCI2OS4xXCIsXG4gIHR6OiBcIjIwMjFhXCIsXG4gIHVuaWNvZGU6IFwiMTMuMFwiLFxuICAuLi5EZW5vLnZlcnNpb24sXG59O1xuXG5mdW5jdGlvbiBocnRpbWUodGltZT86IFtudW1iZXIsIG51bWJlcl0pOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgY29uc3QgbWlsbGkgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgY29uc3Qgc2VjID0gTWF0aC5mbG9vcihtaWxsaSAvIDEwMDApO1xuICBjb25zdCBuYW5vID0gTWF0aC5mbG9vcihtaWxsaSAqIDFfMDAwXzAwMCAtIHNlYyAqIDFfMDAwXzAwMF8wMDApO1xuICBpZiAoIXRpbWUpIHtcbiAgICByZXR1cm4gW3NlYywgbmFub107XG4gIH1cbiAgY29uc3QgW3ByZXZTZWMsIHByZXZOYW5vXSA9IHRpbWU7XG4gIHJldHVybiBbc2VjIC0gcHJldlNlYywgbmFubyAtIHByZXZOYW5vXTtcbn1cblxuaHJ0aW1lLmJpZ2ludCA9IGZ1bmN0aW9uICgpOiBCaWdJbnQge1xuICBjb25zdCBbc2VjLCBuYW5vXSA9IGhydGltZSgpO1xuICByZXR1cm4gQmlnSW50KHNlYykgKiAxXzAwMF8wMDBfMDAwbiArIEJpZ0ludChuYW5vKTtcbn07XG5cbmZ1bmN0aW9uIG1lbW9yeVVzYWdlKCk6IHtcbiAgcnNzOiBudW1iZXI7XG4gIGhlYXBUb3RhbDogbnVtYmVyO1xuICBoZWFwVXNlZDogbnVtYmVyO1xuICBleHRlcm5hbDogbnVtYmVyO1xuICBhcnJheUJ1ZmZlcnM6IG51bWJlcjtcbn0ge1xuICByZXR1cm4ge1xuICAgIC4uLkRlbm8ubWVtb3J5VXNhZ2UoKSxcbiAgICBhcnJheUJ1ZmZlcnM6IDAsXG4gIH07XG59XG5cbm1lbW9yeVVzYWdlLnJzcyA9IGZ1bmN0aW9uICgpOiBudW1iZXIge1xuICByZXR1cm4gbWVtb3J5VXNhZ2UoKS5yc3M7XG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxRkFBcUY7QUFFckYsZ0ZBQWdGO0FBQ2hGLGtFQUFrRTtBQUVsRSxTQUFTLFNBQVMsUUFBUSxtQkFBbUIsQ0FBQztBQUM5QyxTQUFTLFFBQVEsSUFBSSxTQUFTLFFBQVEsa0JBQWtCLENBQUM7QUFHekQsMkZBQTJGLENBQzNGLFNBQVMsS0FBSyxHQUFXO0lBQ3ZCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksUUFBUSxFQUFFO1FBQy9CLE9BQU8sS0FBSyxDQUFDO0tBQ2QsTUFBTSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLFNBQVMsRUFBRTtRQUN2QyxPQUFPLE9BQU8sQ0FBQztLQUNoQixNQUFNO1FBQ0wsTUFBTSxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7S0FDNUI7Q0FDRjtB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