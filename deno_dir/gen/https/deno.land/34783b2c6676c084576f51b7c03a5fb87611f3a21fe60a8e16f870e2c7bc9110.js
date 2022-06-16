// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { deferred } from "./deferred.ts";
/** The MuxAsyncIterator class multiplexes multiple async iterators into a
 * single stream. It currently makes an assumption:
 * - The final result (the value returned and not yielded from the iterator)
 *   does not matter; if there is any, it is discarded.
 */ export class MuxAsyncIterator {
    iteratorCount = 0;
    yields = [];
    // deno-lint-ignore no-explicit-any
    throws = [];
    signal = deferred();
    add(iterable) {
        ++this.iteratorCount;
        this.callIteratorNext(iterable[Symbol.asyncIterator]());
    }
    async callIteratorNext(iterator) {
        try {
            const { value , done  } = await iterator.next();
            if (done) {
                --this.iteratorCount;
            } else {
                this.yields.push({
                    iterator,
                    value
                });
            }
        } catch (e) {
            this.throws.push(e);
        }
        this.signal.resolve();
    }
    async *iterate() {
        while(this.iteratorCount > 0){
            // Sleep until any of the wrapped iterators yields.
            await this.signal;
            // Note that while we're looping over `yields`, new items may be added.
            for(let i = 0; i < this.yields.length; i++){
                const { iterator , value  } = this.yields[i];
                yield value;
                this.callIteratorNext(iterator);
            }
            if (this.throws.length) {
                for (const e of this.throws){
                    throw e;
                }
                this.throws.length = 0;
            }
            // Clear the `yields` list and reset the `signal` promise.
            this.yields.length = 0;
            this.signal = deferred();
        }
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjk4LjAvYXN5bmMvbXV4X2FzeW5jX2l0ZXJhdG9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBEZWZlcnJlZCwgZGVmZXJyZWQgfSBmcm9tIFwiLi9kZWZlcnJlZC50c1wiO1xuXG5pbnRlcmZhY2UgVGFnZ2VkWWllbGRlZFZhbHVlPFQ+IHtcbiAgaXRlcmF0b3I6IEFzeW5jSXRlcmF0b3I8VD47XG4gIHZhbHVlOiBUO1xufVxuXG4vKiogVGhlIE11eEFzeW5jSXRlcmF0b3IgY2xhc3MgbXVsdGlwbGV4ZXMgbXVsdGlwbGUgYXN5bmMgaXRlcmF0b3JzIGludG8gYVxuICogc2luZ2xlIHN0cmVhbS4gSXQgY3VycmVudGx5IG1ha2VzIGFuIGFzc3VtcHRpb246XG4gKiAtIFRoZSBmaW5hbCByZXN1bHQgKHRoZSB2YWx1ZSByZXR1cm5lZCBhbmQgbm90IHlpZWxkZWQgZnJvbSB0aGUgaXRlcmF0b3IpXG4gKiAgIGRvZXMgbm90IG1hdHRlcjsgaWYgdGhlcmUgaXMgYW55LCBpdCBpcyBkaXNjYXJkZWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBNdXhBc3luY0l0ZXJhdG9yPFQ+IGltcGxlbWVudHMgQXN5bmNJdGVyYWJsZTxUPiB7XG4gIHByaXZhdGUgaXRlcmF0b3JDb3VudCA9IDA7XG4gIHByaXZhdGUgeWllbGRzOiBBcnJheTxUYWdnZWRZaWVsZGVkVmFsdWU8VD4+ID0gW107XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHByaXZhdGUgdGhyb3dzOiBhbnlbXSA9IFtdO1xuICBwcml2YXRlIHNpZ25hbDogRGVmZXJyZWQ8dm9pZD4gPSBkZWZlcnJlZCgpO1xuXG4gIGFkZChpdGVyYWJsZTogQXN5bmNJdGVyYWJsZTxUPik6IHZvaWQge1xuICAgICsrdGhpcy5pdGVyYXRvckNvdW50O1xuICAgIHRoaXMuY2FsbEl0ZXJhdG9yTmV4dChpdGVyYWJsZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGNhbGxJdGVyYXRvck5leHQoXG4gICAgaXRlcmF0b3I6IEFzeW5jSXRlcmF0b3I8VD4sXG4gICkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoZG9uZSkge1xuICAgICAgICAtLXRoaXMuaXRlcmF0b3JDb3VudDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMueWllbGRzLnB1c2goeyBpdGVyYXRvciwgdmFsdWUgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy50aHJvd3MucHVzaChlKTtcbiAgICB9XG4gICAgdGhpcy5zaWduYWwucmVzb2x2ZSgpO1xuICB9XG5cbiAgYXN5bmMgKml0ZXJhdGUoKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFQ+IHtcbiAgICB3aGlsZSAodGhpcy5pdGVyYXRvckNvdW50ID4gMCkge1xuICAgICAgLy8gU2xlZXAgdW50aWwgYW55IG9mIHRoZSB3cmFwcGVkIGl0ZXJhdG9ycyB5aWVsZHMuXG4gICAgICBhd2FpdCB0aGlzLnNpZ25hbDtcblxuICAgICAgLy8gTm90ZSB0aGF0IHdoaWxlIHdlJ3JlIGxvb3Bpbmcgb3ZlciBgeWllbGRzYCwgbmV3IGl0ZW1zIG1heSBiZSBhZGRlZC5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy55aWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgeyBpdGVyYXRvciwgdmFsdWUgfSA9IHRoaXMueWllbGRzW2ldO1xuICAgICAgICB5aWVsZCB2YWx1ZTtcbiAgICAgICAgdGhpcy5jYWxsSXRlcmF0b3JOZXh0KGl0ZXJhdG9yKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudGhyb3dzLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy50aHJvd3MpIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGhyb3dzLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICAvLyBDbGVhciB0aGUgYHlpZWxkc2AgbGlzdCBhbmQgcmVzZXQgdGhlIGBzaWduYWxgIHByb21pc2UuXG4gICAgICB0aGlzLnlpZWxkcy5sZW5ndGggPSAwO1xuICAgICAgdGhpcy5zaWduYWwgPSBkZWZlcnJlZCgpO1xuICAgIH1cbiAgfVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTogQXN5bmNJdGVyYXRvcjxUPiB7XG4gICAgcmV0dXJuIHRoaXMuaXRlcmF0ZSgpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQW1CLFFBQVEsUUFBUSxlQUFlLENBQUM7QUFPbkQ7Ozs7R0FJRyxDQUNILE9BQU8sTUFBTSxnQkFBZ0I7SUFDM0IsQUFBUSxhQUFhLEdBQUcsQ0FBQyxDQUFDO0lBQzFCLEFBQVEsTUFBTSxHQUFpQyxFQUFFLENBQUM7SUFDbEQsbUNBQW1DO0lBQ25DLEFBQVEsTUFBTSxHQUFVLEVBQUUsQ0FBQztJQUMzQixBQUFRLE1BQU0sR0FBbUIsUUFBUSxFQUFFLENBQUM7SUFFNUMsR0FBRyxDQUFDLFFBQTBCLEVBQVE7UUFDcEMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUN6RDtJQUVELE1BQWMsZ0JBQWdCLENBQzVCLFFBQTBCLEVBQzFCO1FBQ0EsSUFBSTtZQUNGLE1BQU0sRUFBRSxLQUFLLENBQUEsRUFBRSxJQUFJLENBQUEsRUFBRSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxBQUFDO1lBQzlDLElBQUksSUFBSSxFQUFFO2dCQUNSLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQzthQUN0QixNQUFNO2dCQUNMLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO29CQUFFLFFBQVE7b0JBQUUsS0FBSztpQkFBRSxDQUFDLENBQUM7YUFDdkM7U0FDRixDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDckI7UUFDRCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3ZCO0lBRUQsT0FBTyxPQUFPLEdBQTZCO1FBQ3pDLE1BQU8sSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUU7WUFDN0IsbURBQW1EO1lBQ25ELE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUVsQix1RUFBdUU7WUFDdkUsSUFBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFFO2dCQUMzQyxNQUFNLEVBQUUsUUFBUSxDQUFBLEVBQUUsS0FBSyxDQUFBLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxBQUFDO2dCQUMzQyxNQUFNLEtBQUssQ0FBQztnQkFDWixJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDakM7WUFFRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUN0QixLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUU7b0JBQzNCLE1BQU0sQ0FBQyxDQUFDO2lCQUNUO2dCQUNELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQzthQUN4QjtZQUNELDBEQUEwRDtZQUMxRCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxRQUFRLEVBQUUsQ0FBQztTQUMxQjtLQUNGO0lBRUQsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQXFCO1FBQ3pDLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3ZCO0NBQ0YifQ==