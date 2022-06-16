class Queue {
    #source;
    #queue;
    head;
    done;
    constructor(iterable){
        this.#source = iterable[Symbol.asyncIterator]();
        this.#queue = {
            value: undefined,
            next: undefined
        };
        this.head = this.#queue;
        this.done = false;
    }
    async next() {
        const result = await this.#source.next();
        if (!result.done) {
            const nextNode = {
                value: result.value,
                next: undefined
            };
            this.#queue.next = nextNode;
            this.#queue = nextNode;
        } else {
            this.done = true;
        }
    }
}
/**
 * Branches the given async iterable into the n branches.
 *
 * Example:
 *
 * ```ts
 *     import { tee } from "./tee.ts";
 *
 *     const gen = async function* gen() {
 *       yield 1;
 *       yield 2;
 *       yield 3;
 *     }
 *
 *     const [branch1, branch2] = tee(gen());
 *
 *     (async () => {
 *       for await (const n of branch1) {
 *         console.log(n); // => 1, 2, 3
 *       }
 *     })();
 *
 *     (async () => {
 *       for await (const n of branch2) {
 *         console.log(n); // => 1, 2, 3
 *       }
 *     })();
 * ```
 */ export function tee(iterable, n = 2) {
    const queue = new Queue(iterable);
    async function* generator() {
        let buffer = queue.head;
        while(true){
            if (buffer.next) {
                buffer = buffer.next;
                yield buffer.value;
            } else if (queue.done) {
                return;
            } else {
                await queue.next();
            }
        }
    }
    const branches = Array.from({
        length: n
    }).map(()=>generator());
    return branches;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL2FzeW5jL3RlZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG4vLyBVdGlsaXR5IGZvciByZXByZXNlbnRpbmcgbi10dXBsZVxudHlwZSBUdXBsZTxULCBOIGV4dGVuZHMgbnVtYmVyPiA9IE4gZXh0ZW5kcyBOXG4gID8gbnVtYmVyIGV4dGVuZHMgTiA/IFRbXSA6IFR1cGxlT2Y8VCwgTiwgW10+XG4gIDogbmV2ZXI7XG50eXBlIFR1cGxlT2Y8VCwgTiBleHRlbmRzIG51bWJlciwgUiBleHRlbmRzIHVua25vd25bXT4gPSBSW1wibGVuZ3RoXCJdIGV4dGVuZHMgTlxuICA/IFJcbiAgOiBUdXBsZU9mPFQsIE4sIFtULCAuLi5SXT47XG5cbmludGVyZmFjZSBRdWV1ZU5vZGU8VD4ge1xuICB2YWx1ZTogVDtcbiAgbmV4dDogUXVldWVOb2RlPFQ+IHwgdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBRdWV1ZTxUPiB7XG4gICNzb3VyY2U6IEFzeW5jSXRlcmF0b3I8VD47XG4gICNxdWV1ZTogUXVldWVOb2RlPFQ+O1xuICBoZWFkOiBRdWV1ZU5vZGU8VD47XG5cbiAgZG9uZTogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihpdGVyYWJsZTogQXN5bmNJdGVyYWJsZTxUPikge1xuICAgIHRoaXMuI3NvdXJjZSA9IGl0ZXJhYmxlW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpO1xuICAgIHRoaXMuI3F1ZXVlID0ge1xuICAgICAgdmFsdWU6IHVuZGVmaW5lZCEsXG4gICAgICBuZXh0OiB1bmRlZmluZWQsXG4gICAgfTtcbiAgICB0aGlzLmhlYWQgPSB0aGlzLiNxdWV1ZTtcbiAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgfVxuXG4gIGFzeW5jIG5leHQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy4jc291cmNlLm5leHQoKTtcbiAgICBpZiAoIXJlc3VsdC5kb25lKSB7XG4gICAgICBjb25zdCBuZXh0Tm9kZTogUXVldWVOb2RlPFQ+ID0ge1xuICAgICAgICB2YWx1ZTogcmVzdWx0LnZhbHVlLFxuICAgICAgICBuZXh0OiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgICAgdGhpcy4jcXVldWUubmV4dCA9IG5leHROb2RlO1xuICAgICAgdGhpcy4jcXVldWUgPSBuZXh0Tm9kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kb25lID0gdHJ1ZTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBCcmFuY2hlcyB0aGUgZ2l2ZW4gYXN5bmMgaXRlcmFibGUgaW50byB0aGUgbiBicmFuY2hlcy5cbiAqXG4gKiBFeGFtcGxlOlxuICpcbiAqIGBgYHRzXG4gKiAgICAgaW1wb3J0IHsgdGVlIH0gZnJvbSBcIi4vdGVlLnRzXCI7XG4gKlxuICogICAgIGNvbnN0IGdlbiA9IGFzeW5jIGZ1bmN0aW9uKiBnZW4oKSB7XG4gKiAgICAgICB5aWVsZCAxO1xuICogICAgICAgeWllbGQgMjtcbiAqICAgICAgIHlpZWxkIDM7XG4gKiAgICAgfVxuICpcbiAqICAgICBjb25zdCBbYnJhbmNoMSwgYnJhbmNoMl0gPSB0ZWUoZ2VuKCkpO1xuICpcbiAqICAgICAoYXN5bmMgKCkgPT4ge1xuICogICAgICAgZm9yIGF3YWl0IChjb25zdCBuIG9mIGJyYW5jaDEpIHtcbiAqICAgICAgICAgY29uc29sZS5sb2cobik7IC8vID0+IDEsIDIsIDNcbiAqICAgICAgIH1cbiAqICAgICB9KSgpO1xuICpcbiAqICAgICAoYXN5bmMgKCkgPT4ge1xuICogICAgICAgZm9yIGF3YWl0IChjb25zdCBuIG9mIGJyYW5jaDIpIHtcbiAqICAgICAgICAgY29uc29sZS5sb2cobik7IC8vID0+IDEsIDIsIDNcbiAqICAgICAgIH1cbiAqICAgICB9KSgpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZWU8VCwgTiBleHRlbmRzIG51bWJlciA9IDI+KFxuICBpdGVyYWJsZTogQXN5bmNJdGVyYWJsZTxUPixcbiAgbjogTiA9IDIgYXMgTixcbik6IFR1cGxlPEFzeW5jSXRlcmFibGU8VD4sIE4+IHtcbiAgY29uc3QgcXVldWUgPSBuZXcgUXVldWU8VD4oaXRlcmFibGUpO1xuXG4gIGFzeW5jIGZ1bmN0aW9uKiBnZW5lcmF0b3IoKTogQXN5bmNHZW5lcmF0b3I8VD4ge1xuICAgIGxldCBidWZmZXIgPSBxdWV1ZS5oZWFkO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAoYnVmZmVyLm5leHQpIHtcbiAgICAgICAgYnVmZmVyID0gYnVmZmVyLm5leHQ7XG4gICAgICAgIHlpZWxkIGJ1ZmZlci52YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAocXVldWUuZG9uZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBxdWV1ZS5uZXh0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgYnJhbmNoZXMgPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiBuIH0pLm1hcChcbiAgICAoKSA9PiBnZW5lcmF0b3IoKSxcbiAgKSBhcyBUdXBsZTxcbiAgICBBc3luY0l0ZXJhYmxlPFQ+LFxuICAgIE5cbiAgPjtcbiAgcmV0dXJuIGJyYW5jaGVzO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWdCQSxNQUFNLEtBQUs7SUFDVCxDQUFDLE1BQU0sQ0FBbUI7SUFDMUIsQ0FBQyxLQUFLLENBQWU7SUFDckIsSUFBSSxDQUFlO0lBRW5CLElBQUksQ0FBVTtJQUVkLFlBQVksUUFBMEIsQ0FBRTtRQUN0QyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO1FBQ2hELElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRztZQUNaLEtBQUssRUFBRSxTQUFTO1lBQ2hCLElBQUksRUFBRSxTQUFTO1NBQ2hCLENBQUM7UUFDRixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztLQUNuQjtJQUVELE1BQU0sSUFBSSxHQUFrQjtRQUMxQixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQUFBQztRQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtZQUNoQixNQUFNLFFBQVEsR0FBaUI7Z0JBQzdCLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDbkIsSUFBSSxFQUFFLFNBQVM7YUFDaEIsQUFBQztZQUNGLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO1lBQzVCLElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUM7U0FDeEIsTUFBTTtZQUNMLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1NBQ2xCO0tBQ0Y7Q0FDRjtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNEJHLENBQ0gsT0FBTyxTQUFTLEdBQUcsQ0FDakIsUUFBMEIsRUFDMUIsQ0FBSSxHQUFHLENBQUMsQUFBSyxFQUNlO0lBQzVCLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFJLFFBQVEsQ0FBQyxBQUFDO0lBRXJDLGdCQUFnQixTQUFTLEdBQXNCO1FBQzdDLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLEFBQUM7UUFDeEIsTUFBTyxJQUFJLENBQUU7WUFDWCxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7Z0JBQ2YsTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7Z0JBQ3JCLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQzthQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtnQkFDckIsT0FBTzthQUNSLE1BQU07Z0JBQ0wsTUFBTSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDcEI7U0FDRjtLQUNGO0lBRUQsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUFFLE1BQU0sRUFBRSxDQUFDO0tBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FDNUMsSUFBTSxTQUFTLEVBQUUsQ0FDbEIsQUFHQSxBQUFDO0lBQ0YsT0FBTyxRQUFRLENBQUM7Q0FDakIifQ==