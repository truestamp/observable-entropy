// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
// Currently optimal queue size, tested on V8 6.0 - 6.6. Must be power of two.
const kSize = 2048;
const kMask = kSize - 1;
// The FixedQueue is implemented as a singly-linked list of fixed-size
// circular buffers. It looks something like this:
//
//  head                                                       tail
//    |                                                          |
//    v                                                          v
// +-----------+ <-----\       +-----------+ <------\         +-----------+
// |  [null]   |        \----- |   next    |         \------- |   next    |
// +-----------+               +-----------+                  +-----------+
// |   item    | <-- bottom    |   item    | <-- bottom       |  [empty]  |
// |   item    |               |   item    |                  |  [empty]  |
// |   item    |               |   item    |                  |  [empty]  |
// |   item    |               |   item    |                  |  [empty]  |
// |   item    |               |   item    |       bottom --> |   item    |
// |   item    |               |   item    |                  |   item    |
// |    ...    |               |    ...    |                  |    ...    |
// |   item    |               |   item    |                  |   item    |
// |   item    |               |   item    |                  |   item    |
// |  [empty]  | <-- top       |   item    |                  |   item    |
// |  [empty]  |               |   item    |                  |   item    |
// |  [empty]  |               |  [empty]  | <-- top  top --> |  [empty]  |
// +-----------+               +-----------+                  +-----------+
//
// Or, if there is only one circular buffer, it looks something
// like either of these:
//
//  head   tail                                 head   tail
//    |     |                                     |     |
//    v     v                                     v     v
// +-----------+                               +-----------+
// |  [null]   |                               |  [null]   |
// +-----------+                               +-----------+
// |  [empty]  |                               |   item    |
// |  [empty]  |                               |   item    |
// |   item    | <-- bottom            top --> |  [empty]  |
// |   item    |                               |  [empty]  |
// |  [empty]  | <-- top            bottom --> |   item    |
// |  [empty]  |                               |   item    |
// +-----------+                               +-----------+
//
// Adding a value means moving `top` forward by one, removing means
// moving `bottom` forward by one. After reaching the end, the queue
// wraps around.
//
// When `top === bottom` the current queue is empty and when
// `top + 1 === bottom` it's full. This wastes a single space of storage
// but allows much quicker checks.
class FixedCircularBuffer {
    bottom;
    top;
    list;
    next;
    constructor(){
        this.bottom = 0;
        this.top = 0;
        this.list = new Array(kSize);
        this.next = null;
    }
    isEmpty() {
        return this.top === this.bottom;
    }
    isFull() {
        return (this.top + 1 & kMask) === this.bottom;
    }
    push(data) {
        this.list[this.top] = data;
        this.top = this.top + 1 & kMask;
    }
    shift() {
        const nextItem = this.list[this.bottom];
        if (nextItem === undefined) {
            return null;
        }
        this.list[this.bottom] = undefined;
        this.bottom = this.bottom + 1 & kMask;
        return nextItem;
    }
}
export class FixedQueue {
    head;
    tail;
    constructor(){
        this.head = this.tail = new FixedCircularBuffer();
    }
    isEmpty() {
        return this.head.isEmpty();
    }
    push(data) {
        if (this.head.isFull()) {
            // Head is full: Creates a new queue, sets the old queue's `.next` to it,
            // and sets it as the new main queue.
            this.head = this.head.next = new FixedCircularBuffer();
        }
        this.head.push(data);
    }
    shift() {
        const tail = this.tail;
        const next = tail.shift();
        if (tail.isEmpty() && tail.next !== null) {
            // If there is another queue, it forms the new tail.
            this.tail = tail.next;
        }
        return next;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvX2ZpeGVkX3F1ZXVlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cblxuLy8gQ3VycmVudGx5IG9wdGltYWwgcXVldWUgc2l6ZSwgdGVzdGVkIG9uIFY4IDYuMCAtIDYuNi4gTXVzdCBiZSBwb3dlciBvZiB0d28uXG5jb25zdCBrU2l6ZSA9IDIwNDg7XG5jb25zdCBrTWFzayA9IGtTaXplIC0gMTtcblxuLy8gVGhlIEZpeGVkUXVldWUgaXMgaW1wbGVtZW50ZWQgYXMgYSBzaW5nbHktbGlua2VkIGxpc3Qgb2YgZml4ZWQtc2l6ZVxuLy8gY2lyY3VsYXIgYnVmZmVycy4gSXQgbG9va3Mgc29tZXRoaW5nIGxpa2UgdGhpczpcbi8vXG4vLyAgaGVhZCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YWlsXG4vLyAgICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbi8vICAgIHYgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdlxuLy8gKy0tLS0tLS0tLS0tKyA8LS0tLS1cXCAgICAgICArLS0tLS0tLS0tLS0rIDwtLS0tLS1cXCAgICAgICAgICstLS0tLS0tLS0tLStcbi8vIHwgIFtudWxsXSAgIHwgICAgICAgIFxcLS0tLS0gfCAgIG5leHQgICAgfCAgICAgICAgIFxcLS0tLS0tLSB8ICAgbmV4dCAgICB8XG4vLyArLS0tLS0tLS0tLS0rICAgICAgICAgICAgICAgKy0tLS0tLS0tLS0tKyAgICAgICAgICAgICAgICAgICstLS0tLS0tLS0tLStcbi8vIHwgICBpdGVtICAgIHwgPC0tIGJvdHRvbSAgICB8ICAgaXRlbSAgICB8IDwtLSBib3R0b20gICAgICAgfCAgW2VtcHR5XSAgfFxuLy8gfCAgIGl0ZW0gICAgfCAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHwgICAgICAgICAgICAgICAgICB8ICBbZW1wdHldICB8XG4vLyB8ICAgaXRlbSAgICB8ICAgICAgICAgICAgICAgfCAgIGl0ZW0gICAgfCAgICAgICAgICAgICAgICAgIHwgIFtlbXB0eV0gIHxcbi8vIHwgICBpdGVtICAgIHwgICAgICAgICAgICAgICB8ICAgaXRlbSAgICB8ICAgICAgICAgICAgICAgICAgfCAgW2VtcHR5XSAgfFxuLy8gfCAgIGl0ZW0gICAgfCAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHwgICAgICAgYm90dG9tIC0tPiB8ICAgaXRlbSAgICB8XG4vLyB8ICAgaXRlbSAgICB8ICAgICAgICAgICAgICAgfCAgIGl0ZW0gICAgfCAgICAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHxcbi8vIHwgICAgLi4uICAgIHwgICAgICAgICAgICAgICB8ICAgIC4uLiAgICB8ICAgICAgICAgICAgICAgICAgfCAgICAuLi4gICAgfFxuLy8gfCAgIGl0ZW0gICAgfCAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHwgICAgICAgICAgICAgICAgICB8ICAgaXRlbSAgICB8XG4vLyB8ICAgaXRlbSAgICB8ICAgICAgICAgICAgICAgfCAgIGl0ZW0gICAgfCAgICAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHxcbi8vIHwgIFtlbXB0eV0gIHwgPC0tIHRvcCAgICAgICB8ICAgaXRlbSAgICB8ICAgICAgICAgICAgICAgICAgfCAgIGl0ZW0gICAgfFxuLy8gfCAgW2VtcHR5XSAgfCAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHwgICAgICAgICAgICAgICAgICB8ICAgaXRlbSAgICB8XG4vLyB8ICBbZW1wdHldICB8ICAgICAgICAgICAgICAgfCAgW2VtcHR5XSAgfCA8LS0gdG9wICB0b3AgLS0+IHwgIFtlbXB0eV0gIHxcbi8vICstLS0tLS0tLS0tLSsgICAgICAgICAgICAgICArLS0tLS0tLS0tLS0rICAgICAgICAgICAgICAgICAgKy0tLS0tLS0tLS0tK1xuLy9cbi8vIE9yLCBpZiB0aGVyZSBpcyBvbmx5IG9uZSBjaXJjdWxhciBidWZmZXIsIGl0IGxvb2tzIHNvbWV0aGluZ1xuLy8gbGlrZSBlaXRoZXIgb2YgdGhlc2U6XG4vL1xuLy8gIGhlYWQgICB0YWlsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZCAgIHRhaWxcbi8vICAgIHwgICAgIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgICAgfFxuLy8gICAgdiAgICAgdiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ICAgICB2XG4vLyArLS0tLS0tLS0tLS0rICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICstLS0tLS0tLS0tLStcbi8vIHwgIFtudWxsXSAgIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgW251bGxdICAgfFxuLy8gKy0tLS0tLS0tLS0tKyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArLS0tLS0tLS0tLS0rXG4vLyB8ICBbZW1wdHldICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgICBpdGVtICAgIHxcbi8vIHwgIFtlbXB0eV0gIHwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAgIGl0ZW0gICAgfFxuLy8gfCAgIGl0ZW0gICAgfCA8LS0gYm90dG9tICAgICAgICAgICAgdG9wIC0tPiB8ICBbZW1wdHldICB8XG4vLyB8ICAgaXRlbSAgICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgIFtlbXB0eV0gIHxcbi8vIHwgIFtlbXB0eV0gIHwgPC0tIHRvcCAgICAgICAgICAgIGJvdHRvbSAtLT4gfCAgIGl0ZW0gICAgfFxuLy8gfCAgW2VtcHR5XSAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICAgaXRlbSAgICB8XG4vLyArLS0tLS0tLS0tLS0rICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICstLS0tLS0tLS0tLStcbi8vXG4vLyBBZGRpbmcgYSB2YWx1ZSBtZWFucyBtb3ZpbmcgYHRvcGAgZm9yd2FyZCBieSBvbmUsIHJlbW92aW5nIG1lYW5zXG4vLyBtb3ZpbmcgYGJvdHRvbWAgZm9yd2FyZCBieSBvbmUuIEFmdGVyIHJlYWNoaW5nIHRoZSBlbmQsIHRoZSBxdWV1ZVxuLy8gd3JhcHMgYXJvdW5kLlxuLy9cbi8vIFdoZW4gYHRvcCA9PT0gYm90dG9tYCB0aGUgY3VycmVudCBxdWV1ZSBpcyBlbXB0eSBhbmQgd2hlblxuLy8gYHRvcCArIDEgPT09IGJvdHRvbWAgaXQncyBmdWxsLiBUaGlzIHdhc3RlcyBhIHNpbmdsZSBzcGFjZSBvZiBzdG9yYWdlXG4vLyBidXQgYWxsb3dzIG11Y2ggcXVpY2tlciBjaGVja3MuXG5cbmNsYXNzIEZpeGVkQ2lyY3VsYXJCdWZmZXIge1xuICBib3R0b206IG51bWJlcjtcbiAgdG9wOiBudW1iZXI7XG4gIGxpc3Q6IHVuZGVmaW5lZCB8IEFycmF5PHVua25vd24+O1xuICBuZXh0OiBGaXhlZENpcmN1bGFyQnVmZmVyIHwgbnVsbDtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmJvdHRvbSA9IDA7XG4gICAgdGhpcy50b3AgPSAwO1xuICAgIHRoaXMubGlzdCA9IG5ldyBBcnJheShrU2l6ZSk7XG4gICAgdGhpcy5uZXh0ID0gbnVsbDtcbiAgfVxuXG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9wID09PSB0aGlzLmJvdHRvbTtcbiAgfVxuXG4gIGlzRnVsbCgpIHtcbiAgICByZXR1cm4gKCh0aGlzLnRvcCArIDEpICYga01hc2spID09PSB0aGlzLmJvdHRvbTtcbiAgfVxuXG4gIHB1c2goZGF0YTogdW5rbm93bikge1xuICAgIHRoaXMubGlzdCFbdGhpcy50b3BdID0gZGF0YTtcbiAgICB0aGlzLnRvcCA9ICh0aGlzLnRvcCArIDEpICYga01hc2s7XG4gIH1cblxuICBzaGlmdCgpIHtcbiAgICBjb25zdCBuZXh0SXRlbSA9IHRoaXMubGlzdCFbdGhpcy5ib3R0b21dO1xuICAgIGlmIChuZXh0SXRlbSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5saXN0IVt0aGlzLmJvdHRvbV0gPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5ib3R0b20gPSAodGhpcy5ib3R0b20gKyAxKSAmIGtNYXNrO1xuICAgIHJldHVybiBuZXh0SXRlbTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRml4ZWRRdWV1ZSB7XG4gIGhlYWQ6IEZpeGVkQ2lyY3VsYXJCdWZmZXI7XG4gIHRhaWw6IEZpeGVkQ2lyY3VsYXJCdWZmZXI7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbmV3IEZpeGVkQ2lyY3VsYXJCdWZmZXIoKTtcbiAgfVxuXG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuaGVhZC5pc0VtcHR5KCk7XG4gIH1cblxuICBwdXNoKGRhdGE6IHVua25vd24pIHtcbiAgICBpZiAodGhpcy5oZWFkLmlzRnVsbCgpKSB7XG4gICAgICAvLyBIZWFkIGlzIGZ1bGw6IENyZWF0ZXMgYSBuZXcgcXVldWUsIHNldHMgdGhlIG9sZCBxdWV1ZSdzIGAubmV4dGAgdG8gaXQsXG4gICAgICAvLyBhbmQgc2V0cyBpdCBhcyB0aGUgbmV3IG1haW4gcXVldWUuXG4gICAgICB0aGlzLmhlYWQgPSB0aGlzLmhlYWQubmV4dCA9IG5ldyBGaXhlZENpcmN1bGFyQnVmZmVyKCk7XG4gICAgfVxuICAgIHRoaXMuaGVhZC5wdXNoKGRhdGEpO1xuICB9XG5cbiAgc2hpZnQoKSB7XG4gICAgY29uc3QgdGFpbCA9IHRoaXMudGFpbDtcbiAgICBjb25zdCBuZXh0ID0gdGFpbC5zaGlmdCgpO1xuICAgIGlmICh0YWlsLmlzRW1wdHkoKSAmJiB0YWlsLm5leHQgIT09IG51bGwpIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGFub3RoZXIgcXVldWUsIGl0IGZvcm1zIHRoZSBuZXcgdGFpbC5cbiAgICAgIHRoaXMudGFpbCA9IHRhaWwubmV4dDtcbiAgICB9XG4gICAgcmV0dXJuIG5leHQ7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0RBQXNEO0FBRXRELDhFQUE4RTtBQUM5RSxNQUFNLEtBQUssR0FBRyxJQUFJLEFBQUM7QUFDbkIsTUFBTSxLQUFLLEdBQUcsS0FBSyxHQUFHLENBQUMsQUFBQztBQUV4QixzRUFBc0U7QUFDdEUsa0RBQWtEO0FBQ2xELEVBQUU7QUFDRixtRUFBbUU7QUFDbkUsa0VBQWtFO0FBQ2xFLGtFQUFrRTtBQUNsRSwyRUFBMkU7QUFDM0UsMkVBQTJFO0FBQzNFLDJFQUEyRTtBQUMzRSwyRUFBMkU7QUFDM0UsMkVBQTJFO0FBQzNFLDJFQUEyRTtBQUMzRSwyRUFBMkU7QUFDM0UsMkVBQTJFO0FBQzNFLDJFQUEyRTtBQUMzRSwyRUFBMkU7QUFDM0UsMkVBQTJFO0FBQzNFLDJFQUEyRTtBQUMzRSwyRUFBMkU7QUFDM0UsMkVBQTJFO0FBQzNFLDJFQUEyRTtBQUMzRSwyRUFBMkU7QUFDM0UsRUFBRTtBQUNGLCtEQUErRDtBQUMvRCx3QkFBd0I7QUFDeEIsRUFBRTtBQUNGLDJEQUEyRDtBQUMzRCx5REFBeUQ7QUFDekQseURBQXlEO0FBQ3pELDREQUE0RDtBQUM1RCw0REFBNEQ7QUFDNUQsNERBQTREO0FBQzVELDREQUE0RDtBQUM1RCw0REFBNEQ7QUFDNUQsNERBQTREO0FBQzVELDREQUE0RDtBQUM1RCw0REFBNEQ7QUFDNUQsNERBQTREO0FBQzVELDREQUE0RDtBQUM1RCxFQUFFO0FBQ0YsbUVBQW1FO0FBQ25FLG9FQUFvRTtBQUNwRSxnQkFBZ0I7QUFDaEIsRUFBRTtBQUNGLDREQUE0RDtBQUM1RCx3RUFBd0U7QUFDeEUsa0NB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