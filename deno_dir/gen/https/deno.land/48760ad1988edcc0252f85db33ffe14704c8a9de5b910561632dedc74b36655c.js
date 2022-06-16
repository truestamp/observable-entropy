// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
// deno-lint-ignore-file no-inner-declarations
import { core } from "./_core.ts";
import { validateCallback } from "./internal/validators.mjs";
import { _exiting } from "./_process/exiting.ts";
import { FixedQueue } from "./_fixed_queue.ts";
const queue = new FixedQueue();
// deno-lint-ignore no-explicit-any
let _nextTick;
if (typeof core.setNextTickCallback !== "undefined") {
    function runNextTicks() {
        // FIXME(bartlomieju): Deno currently doesn't unhandled rejections
        // if (!hasTickScheduled() && !hasRejectionToWarn())
        //   runMicrotasks();
        // if (!hasTickScheduled() && !hasRejectionToWarn())
        //   return;
        if (!core.hasTickScheduled()) {
            core.runMicrotasks();
        }
        if (!core.hasTickScheduled()) {
            return true;
        }
        processTicksAndRejections();
        return true;
    }
    function processTicksAndRejections() {
        let tock;
        do {
            // deno-lint-ignore no-cond-assign
            while(tock = queue.shift()){
                // FIXME(bartlomieju): Deno currently doesn't support async hooks
                // const asyncId = tock[async_id_symbol];
                // emitBefore(asyncId, tock[trigger_async_id_symbol], tock);
                try {
                    const callback = tock.callback;
                    if (tock.args === undefined) {
                        callback();
                    } else {
                        const args = tock.args;
                        switch(args.length){
                            case 1:
                                callback(args[0]);
                                break;
                            case 2:
                                callback(args[0], args[1]);
                                break;
                            case 3:
                                callback(args[0], args[1], args[2]);
                                break;
                            case 4:
                                callback(args[0], args[1], args[2], args[3]);
                                break;
                            default:
                                callback(...args);
                        }
                    }
                } finally{
                // FIXME(bartlomieju): Deno currently doesn't support async hooks
                // if (destroyHooksExist())
                // emitDestroy(asyncId);
                }
            // FIXME(bartlomieju): Deno currently doesn't support async hooks
            // emitAfter(asyncId);
            }
            core.runMicrotasks();
        // FIXME(bartlomieju): Deno currently doesn't unhandled rejections
        // } while (!queue.isEmpty() || processPromiseRejections());
        }while (!queue.isEmpty())
        core.setHasTickScheduled(false);
    // FIXME(bartlomieju): Deno currently doesn't unhandled rejections
    // setHasRejectionToWarn(false);
    }
    core.setNextTickCallback(processTicksAndRejections);
    core.setMacrotaskCallback(runNextTicks);
    function __nextTickNative(callback, ...args) {
        validateCallback(callback);
        if (_exiting) {
            return;
        }
        // TODO(bartlomieju): seems superfluous if we don't depend on `arguments`
        let args_;
        switch(args.length){
            case 0:
                break;
            case 1:
                args_ = [
                    args[0]
                ];
                break;
            case 2:
                args_ = [
                    args[0],
                    args[1]
                ];
                break;
            case 3:
                args_ = [
                    args[0],
                    args[1],
                    args[2]
                ];
                break;
            default:
                args_ = new Array(args.length);
                for(let i = 0; i < args.length; i++){
                    args_[i] = args[i];
                }
        }
        if (queue.isEmpty()) {
            core.setHasTickScheduled(true);
        }
        // FIXME(bartlomieju): Deno currently doesn't support async hooks
        // const asyncId = newAsyncId();
        // const triggerAsyncId = getDefaultTriggerAsyncId();
        const tickObject = {
            // FIXME(bartlomieju): Deno currently doesn't support async hooks
            // [async_id_symbol]: asyncId,
            // [trigger_async_id_symbol]: triggerAsyncId,
            callback,
            args: args_
        };
        // FIXME(bartlomieju): Deno currently doesn't support async hooks
        // if (initHooksExist())
        //   emitInit(asyncId, 'TickObject', triggerAsyncId, tickObject);
        queue.push(tickObject);
    }
    _nextTick = __nextTickNative;
} else {
    function __nextTickQueueMicrotask(callback, ...args) {
        if (args) {
            queueMicrotask(()=>callback.call(this, ...args));
        } else {
            queueMicrotask(callback);
        }
    }
    _nextTick = __nextTickQueueMicrotask;
}
export function nextTick(callback, ...args) {
    _nextTick(callback, ...args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvX25leHRfdGljay50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG5cbi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby1pbm5lci1kZWNsYXJhdGlvbnNcblxuaW1wb3J0IHsgY29yZSB9IGZyb20gXCIuL19jb3JlLnRzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUNhbGxiYWNrIH0gZnJvbSBcIi4vaW50ZXJuYWwvdmFsaWRhdG9ycy5tanNcIjtcbmltcG9ydCB7IF9leGl0aW5nIH0gZnJvbSBcIi4vX3Byb2Nlc3MvZXhpdGluZy50c1wiO1xuaW1wb3J0IHsgRml4ZWRRdWV1ZSB9IGZyb20gXCIuL19maXhlZF9xdWV1ZS50c1wiO1xuXG5pbnRlcmZhY2UgVG9jayB7XG4gIGNhbGxiYWNrOiAoLi4uYXJnczogQXJyYXk8dW5rbm93bj4pID0+IHZvaWQ7XG4gIGFyZ3M6IEFycmF5PHVua25vd24+O1xufVxuXG5jb25zdCBxdWV1ZSA9IG5ldyBGaXhlZFF1ZXVlKCk7XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5sZXQgX25leHRUaWNrOiBhbnk7XG5cbmlmICh0eXBlb2YgY29yZS5zZXROZXh0VGlja0NhbGxiYWNrICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gIGZ1bmN0aW9uIHJ1bk5leHRUaWNrcygpIHtcbiAgICAvLyBGSVhNRShiYXJ0bG9taWVqdSk6IERlbm8gY3VycmVudGx5IGRvZXNuJ3QgdW5oYW5kbGVkIHJlamVjdGlvbnNcbiAgICAvLyBpZiAoIWhhc1RpY2tTY2hlZHVsZWQoKSAmJiAhaGFzUmVqZWN0aW9uVG9XYXJuKCkpXG4gICAgLy8gICBydW5NaWNyb3Rhc2tzKCk7XG4gICAgLy8gaWYgKCFoYXNUaWNrU2NoZWR1bGVkKCkgJiYgIWhhc1JlamVjdGlvblRvV2FybigpKVxuICAgIC8vICAgcmV0dXJuO1xuICAgIGlmICghY29yZS5oYXNUaWNrU2NoZWR1bGVkKCkpIHtcbiAgICAgIGNvcmUucnVuTWljcm90YXNrcygpO1xuICAgIH1cbiAgICBpZiAoIWNvcmUuaGFzVGlja1NjaGVkdWxlZCgpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcm9jZXNzVGlja3NBbmRSZWplY3Rpb25zKCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9jZXNzVGlja3NBbmRSZWplY3Rpb25zKCkge1xuICAgIGxldCB0b2NrO1xuICAgIGRvIHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tY29uZC1hc3NpZ25cbiAgICAgIHdoaWxlICh0b2NrID0gcXVldWUuc2hpZnQoKSkge1xuICAgICAgICAvLyBGSVhNRShiYXJ0bG9taWVqdSk6IERlbm8gY3VycmVudGx5IGRvZXNuJ3Qgc3VwcG9ydCBhc3luYyBob29rc1xuICAgICAgICAvLyBjb25zdCBhc3luY0lkID0gdG9ja1thc3luY19pZF9zeW1ib2xdO1xuICAgICAgICAvLyBlbWl0QmVmb3JlKGFzeW5jSWQsIHRvY2tbdHJpZ2dlcl9hc3luY19pZF9zeW1ib2xdLCB0b2NrKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gKHRvY2sgYXMgVG9jaykuY2FsbGJhY2s7XG4gICAgICAgICAgaWYgKCh0b2NrIGFzIFRvY2spLmFyZ3MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgYXJncyA9ICh0b2NrIGFzIFRvY2spLmFyZ3M7XG4gICAgICAgICAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhhcmdzWzBdKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjYWxsYmFjayguLi5hcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgYXN5bmMgaG9va3NcbiAgICAgICAgICAvLyBpZiAoZGVzdHJveUhvb2tzRXhpc3QoKSlcbiAgICAgICAgICAvLyBlbWl0RGVzdHJveShhc3luY0lkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KTogRGVubyBjdXJyZW50bHkgZG9lc24ndCBzdXBwb3J0IGFzeW5jIGhvb2tzXG4gICAgICAgIC8vIGVtaXRBZnRlcihhc3luY0lkKTtcbiAgICAgIH1cbiAgICAgIGNvcmUucnVuTWljcm90YXNrcygpO1xuICAgICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHVuaGFuZGxlZCByZWplY3Rpb25zXG4gICAgICAvLyB9IHdoaWxlICghcXVldWUuaXNFbXB0eSgpIHx8IHByb2Nlc3NQcm9taXNlUmVqZWN0aW9ucygpKTtcbiAgICB9IHdoaWxlICghcXVldWUuaXNFbXB0eSgpKTtcbiAgICBjb3JlLnNldEhhc1RpY2tTY2hlZHVsZWQoZmFsc2UpO1xuICAgIC8vIEZJWE1FKGJhcnRsb21pZWp1KTogRGVubyBjdXJyZW50bHkgZG9lc24ndCB1bmhhbmRsZWQgcmVqZWN0aW9uc1xuICAgIC8vIHNldEhhc1JlamVjdGlvblRvV2FybihmYWxzZSk7XG4gIH1cblxuICBjb3JlLnNldE5leHRUaWNrQ2FsbGJhY2socHJvY2Vzc1RpY2tzQW5kUmVqZWN0aW9ucyk7XG4gIGNvcmUuc2V0TWFjcm90YXNrQ2FsbGJhY2socnVuTmV4dFRpY2tzKTtcblxuICBmdW5jdGlvbiBfX25leHRUaWNrTmF0aXZlPFQgZXh0ZW5kcyBBcnJheTx1bmtub3duPj4oXG4gICAgdGhpczogdW5rbm93bixcbiAgICBjYWxsYmFjazogKC4uLmFyZ3M6IFQpID0+IHZvaWQsXG4gICAgLi4uYXJnczogVFxuICApIHtcbiAgICB2YWxpZGF0ZUNhbGxiYWNrKGNhbGxiYWNrKTtcblxuICAgIGlmIChfZXhpdGluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRPRE8oYmFydGxvbWllanUpOiBzZWVtcyBzdXBlcmZsdW91cyBpZiB3ZSBkb24ndCBkZXBlbmQgb24gYGFyZ3VtZW50c2BcbiAgICBsZXQgYXJnc187XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgYXJnc18gPSBbYXJnc1swXV07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBhcmdzXyA9IFthcmdzWzBdLCBhcmdzWzFdXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGFyZ3NfID0gW2FyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl1dO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3NfID0gbmV3IEFycmF5KGFyZ3MubGVuZ3RoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgYXJnc19baV0gPSBhcmdzW2ldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHF1ZXVlLmlzRW1wdHkoKSkge1xuICAgICAgY29yZS5zZXRIYXNUaWNrU2NoZWR1bGVkKHRydWUpO1xuICAgIH1cbiAgICAvLyBGSVhNRShiYXJ0bG9taWVqdSk6IERlbm8gY3VycmVudGx5IGRvZXNuJ3Qgc3VwcG9ydCBhc3luYyBob29rc1xuICAgIC8vIGNvbnN0IGFzeW5jSWQgPSBuZXdBc3luY0lkKCk7XG4gICAgLy8gY29uc3QgdHJpZ2dlckFzeW5jSWQgPSBnZXREZWZhdWx0VHJpZ2dlckFzeW5jSWQoKTtcbiAgICBjb25zdCB0aWNrT2JqZWN0ID0ge1xuICAgICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgYXN5bmMgaG9va3NcbiAgICAgIC8vIFthc3luY19pZF9zeW1ib2xdOiBhc3luY0lkLFxuICAgICAgLy8gW3RyaWdnZXJfYXN5bmNfaWRfc3ltYm9sXTogdHJpZ2dlckFzeW5jSWQsXG4gICAgICBjYWxsYmFjayxcbiAgICAgIGFyZ3M6IGFyZ3NfLFxuICAgIH07XG4gICAgLy8gRklYTUUoYmFydGxvbWllanUpOiBEZW5vIGN1cnJlbnRseSBkb2Vzbid0IHN1cHBvcnQgYXN5bmMgaG9va3NcbiAgICAvLyBpZiAoaW5pdEhvb2tzRXhpc3QoKSlcbiAgICAvLyAgIGVtaXRJbml0KGFzeW5jSWQsICdUaWNrT2JqZWN0JywgdHJpZ2dlckFzeW5jSWQsIHRpY2tPYmplY3QpO1xuICAgIHF1ZXVlLnB1c2godGlja09iamVjdCk7XG4gIH1cbiAgX25leHRUaWNrID0gX19uZXh0VGlja05hdGl2ZTtcbn0gZWxzZSB7XG4gIGZ1bmN0aW9uIF9fbmV4dFRpY2tRdWV1ZU1pY3JvdGFzazxUIGV4dGVuZHMgQXJyYXk8dW5rbm93bj4+KFxuICAgIHRoaXM6IHVua25vd24sXG4gICAgY2FsbGJhY2s6ICguLi5hcmdzOiBUKSA9PiB2b2lkLFxuICAgIC4uLmFyZ3M6IFRcbiAgKSB7XG4gICAgaWYgKGFyZ3MpIHtcbiAgICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IGNhbGxiYWNrLmNhbGwodGhpcywgLi4uYXJncykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBxdWV1ZU1pY3JvdGFzayhjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgX25leHRUaWNrID0gX19uZXh0VGlja1F1ZXVlTWljcm90YXNrO1xufVxuXG4vLyBgbmV4dFRpY2soKWAgd2lsbCBub3QgZW5xdWV1ZSBhbnkgY2FsbGJhY2sgd2hlbiB0aGUgcHJvY2VzcyBpcyBhYm91dCB0b1xuLy8gZXhpdCBzaW5jZSB0aGUgY2FsbGJhY2sgd291bGQgbm90IGhhdmUgYSBjaGFuY2UgdG8gYmUgZXhlY3V0ZWQuXG5leHBvcnQgZnVuY3Rpb24gbmV4dFRpY2sodGhpczogdW5rbm93biwgY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIG5leHRUaWNrPFQgZXh0ZW5kcyBBcnJheTx1bmtub3duPj4oXG4gIHRoaXM6IHVua25vd24sXG4gIGNhbGxiYWNrOiAoLi4uYXJnczogVCkgPT4gdm9pZCxcbiAgLi4uYXJnczogVFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBuZXh0VGljazxUIGV4dGVuZHMgQXJyYXk8dW5rbm93bj4+KFxuICB0aGlzOiB1bmtub3duLFxuICBjYWxsYmFjazogKC4uLmFyZ3M6IFQpID0+IHZvaWQsXG4gIC4uLmFyZ3M6IFRcbikge1xuICBfbmV4dFRpY2soY2FsbGJhY2ssIC4uLmFyZ3MpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxzREFBc0Q7QUFFdEQsOENBQThDO0FBRTlDLFNBQVMsSUFBSSxRQUFR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