// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * pooledMap transforms values from an (async) iterable into another async
 * iterable. The transforms are done concurrently, with a max concurrency
 * defined by the poolLimit.
 *
 * If an error is thrown from `iterableFn`, no new transformations will begin.
 * All currently executing transformations are allowed to finish and still
 * yielded on success. After that, the rejections among them are gathered and
 * thrown by the iterator in an `AggregateError`.
 *
 * @param poolLimit The maximum count of items being processed concurrently.
 * @param array The input array for mapping.
 * @param iteratorFn The function to call for every item of the array.
 */ export function pooledMap(poolLimit, array, iteratorFn) {
    // Create the async iterable that is returned from this function.
    const res = new TransformStream({
        async transform (p, controller) {
            controller.enqueue(await p);
        }
    });
    // Start processing items from the iterator
    (async ()=>{
        const writer = res.writable.getWriter();
        const executing = [];
        try {
            for await (const item of array){
                const p = Promise.resolve().then(()=>iteratorFn(item));
                // Only write on success. If we `writer.write()` a rejected promise,
                // that will end the iteration. We don't want that yet. Instead let it
                // fail the race, taking us to the catch block where all currently
                // executing jobs are allowed to finish and all rejections among them
                // can be reported together.
                p.then((v)=>writer.write(Promise.resolve(v))).catch(()=>{});
                const e = p.then(()=>executing.splice(executing.indexOf(e), 1));
                executing.push(e);
                if (executing.length >= poolLimit) {
                    await Promise.race(executing);
                }
            }
            // Wait until all ongoing events have processed, then close the writer.
            await Promise.all(executing);
            writer.close();
        } catch  {
            const errors = [];
            for (const result of (await Promise.allSettled(executing))){
                if (result.status == "rejected") {
                    errors.push(result.reason);
                }
            }
            writer.write(Promise.reject(new AggregateError(errors, "Threw while mapping."))).catch(()=>{});
        }
    })();
    return res.readable[Symbol.asyncIterator]();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL2FzeW5jL3Bvb2wudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuLyoqXG4gKiBwb29sZWRNYXAgdHJhbnNmb3JtcyB2YWx1ZXMgZnJvbSBhbiAoYXN5bmMpIGl0ZXJhYmxlIGludG8gYW5vdGhlciBhc3luY1xuICogaXRlcmFibGUuIFRoZSB0cmFuc2Zvcm1zIGFyZSBkb25lIGNvbmN1cnJlbnRseSwgd2l0aCBhIG1heCBjb25jdXJyZW5jeVxuICogZGVmaW5lZCBieSB0aGUgcG9vbExpbWl0LlxuICpcbiAqIElmIGFuIGVycm9yIGlzIHRocm93biBmcm9tIGBpdGVyYWJsZUZuYCwgbm8gbmV3IHRyYW5zZm9ybWF0aW9ucyB3aWxsIGJlZ2luLlxuICogQWxsIGN1cnJlbnRseSBleGVjdXRpbmcgdHJhbnNmb3JtYXRpb25zIGFyZSBhbGxvd2VkIHRvIGZpbmlzaCBhbmQgc3RpbGxcbiAqIHlpZWxkZWQgb24gc3VjY2Vzcy4gQWZ0ZXIgdGhhdCwgdGhlIHJlamVjdGlvbnMgYW1vbmcgdGhlbSBhcmUgZ2F0aGVyZWQgYW5kXG4gKiB0aHJvd24gYnkgdGhlIGl0ZXJhdG9yIGluIGFuIGBBZ2dyZWdhdGVFcnJvcmAuXG4gKlxuICogQHBhcmFtIHBvb2xMaW1pdCBUaGUgbWF4aW11bSBjb3VudCBvZiBpdGVtcyBiZWluZyBwcm9jZXNzZWQgY29uY3VycmVudGx5LlxuICogQHBhcmFtIGFycmF5IFRoZSBpbnB1dCBhcnJheSBmb3IgbWFwcGluZy5cbiAqIEBwYXJhbSBpdGVyYXRvckZuIFRoZSBmdW5jdGlvbiB0byBjYWxsIGZvciBldmVyeSBpdGVtIG9mIHRoZSBhcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvb2xlZE1hcDxULCBSPihcbiAgcG9vbExpbWl0OiBudW1iZXIsXG4gIGFycmF5OiBJdGVyYWJsZTxUPiB8IEFzeW5jSXRlcmFibGU8VD4sXG4gIGl0ZXJhdG9yRm46IChkYXRhOiBUKSA9PiBQcm9taXNlPFI+LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFI+IHtcbiAgLy8gQ3JlYXRlIHRoZSBhc3luYyBpdGVyYWJsZSB0aGF0IGlzIHJldHVybmVkIGZyb20gdGhpcyBmdW5jdGlvbi5cbiAgY29uc3QgcmVzID0gbmV3IFRyYW5zZm9ybVN0cmVhbTxQcm9taXNlPFI+LCBSPih7XG4gICAgYXN5bmMgdHJhbnNmb3JtKFxuICAgICAgcDogUHJvbWlzZTxSPixcbiAgICAgIGNvbnRyb2xsZXI6IFRyYW5zZm9ybVN0cmVhbURlZmF1bHRDb250cm9sbGVyPFI+LFxuICAgICkge1xuICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGF3YWl0IHApO1xuICAgIH0sXG4gIH0pO1xuICAvLyBTdGFydCBwcm9jZXNzaW5nIGl0ZW1zIGZyb20gdGhlIGl0ZXJhdG9yXG4gIChhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgd3JpdGVyID0gcmVzLndyaXRhYmxlLmdldFdyaXRlcigpO1xuICAgIGNvbnN0IGV4ZWN1dGluZzogQXJyYXk8UHJvbWlzZTx1bmtub3duPj4gPSBbXTtcbiAgICB0cnkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGFycmF5KSB7XG4gICAgICAgIGNvbnN0IHAgPSBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IGl0ZXJhdG9yRm4oaXRlbSkpO1xuICAgICAgICAvLyBPbmx5IHdyaXRlIG9uIHN1Y2Nlc3MuIElmIHdlIGB3cml0ZXIud3JpdGUoKWAgYSByZWplY3RlZCBwcm9taXNlLFxuICAgICAgICAvLyB0aGF0IHdpbGwgZW5kIHRoZSBpdGVyYXRpb24uIFdlIGRvbid0IHdhbnQgdGhhdCB5ZXQuIEluc3RlYWQgbGV0IGl0XG4gICAgICAgIC8vIGZhaWwgdGhlIHJhY2UsIHRha2luZyB1cyB0byB0aGUgY2F0Y2ggYmxvY2sgd2hlcmUgYWxsIGN1cnJlbnRseVxuICAgICAgICAvLyBleGVjdXRpbmcgam9icyBhcmUgYWxsb3dlZCB0byBmaW5pc2ggYW5kIGFsbCByZWplY3Rpb25zIGFtb25nIHRoZW1cbiAgICAgICAgLy8gY2FuIGJlIHJlcG9ydGVkIHRvZ2V0aGVyLlxuICAgICAgICBwLnRoZW4oKHYpID0+IHdyaXRlci53cml0ZShQcm9taXNlLnJlc29sdmUodikpKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgICAgIGNvbnN0IGU6IFByb21pc2U8dW5rbm93bj4gPSBwLnRoZW4oKCkgPT5cbiAgICAgICAgICBleGVjdXRpbmcuc3BsaWNlKGV4ZWN1dGluZy5pbmRleE9mKGUpLCAxKVxuICAgICAgICApO1xuICAgICAgICBleGVjdXRpbmcucHVzaChlKTtcbiAgICAgICAgaWYgKGV4ZWN1dGluZy5sZW5ndGggPj0gcG9vbExpbWl0KSB7XG4gICAgICAgICAgYXdhaXQgUHJvbWlzZS5yYWNlKGV4ZWN1dGluZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFdhaXQgdW50aWwgYWxsIG9uZ29pbmcgZXZlbnRzIGhhdmUgcHJvY2Vzc2VkLCB0aGVuIGNsb3NlIHRoZSB3cml0ZXIuXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChleGVjdXRpbmcpO1xuICAgICAgd3JpdGVyLmNsb3NlKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCBlcnJvcnMgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChleGVjdXRpbmcpKSB7XG4gICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09IFwicmVqZWN0ZWRcIikge1xuICAgICAgICAgIGVycm9ycy5wdXNoKHJlc3VsdC5yZWFzb24pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB3cml0ZXIud3JpdGUoUHJvbWlzZS5yZWplY3QoXG4gICAgICAgIG5ldyBBZ2dyZWdhdGVFcnJvcihlcnJvcnMsIFwiVGhyZXcgd2hpbGUgbWFwcGluZy5cIiksXG4gICAgICApKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgfVxuICB9KSgpO1xuICByZXR1cm4gcmVzLnJlYWRhYmxlW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRTs7Ozs7Ozs7Ozs7OztHQWFHLENBQ0gsT0FBTyxTQUFTLFNBQVMsQ0FDdkIsU0FBaUIsRUFDakIsS0FBcUMsRUFDckMsVUFBbUMsRUFDVDtJQUMxQixpRUFBaUU7SUFDakUsTUFBTSxHQUFHLEdBQUcsSUFBSSxlQUFlLENBQWdCO1FBQzdDLE1BQU0sU0FBUyxFQUNiLENBQWEsRUFDYixVQUErQyxFQUMvQztZQUNBLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztTQUM3QjtLQUNGLENBQUMsQUFBQztJQUNILDJDQUEyQztJQUMzQyxDQUFDLFVBQVk7UUFDWCxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxBQUFDO1FBQ3hDLE1BQU0sU0FBUyxHQUE0QixFQUFFLEFBQUM7UUFDOUMsSUFBSTtZQUNGLFdBQVcsTUFBTSxJQUFJLElBQUksS0FBSyxDQUFFO2dCQUM5QixNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQU0sVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEFBQUM7Z0JBQ3pELG9FQUFvRTtnQkFDcEUsc0VBQXNFO2dCQUN0RSxrRUFBa0U7Z0JBQ2xFLHFFQUFxRTtnQkFDckUsNEJBQTRCO2dCQUM1QixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQU0sRUFBRSxDQUFDLENBQUM7Z0JBQ2hFLE1BQU0sQ0FBQyxHQUFxQixDQUFDLENBQUMsSUFBSSxDQUFDLElBQ2pDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FDMUMsQUFBQztnQkFDRixTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksU0FBUyxFQUFFO29CQUNqQyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7aUJBQy9CO2FBQ0Y7WUFDRCx1RUFBdUU7WUFDdkUsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztTQUNoQixDQUFDLE9BQU07WUFDTixNQUFNLE1BQU0sR0FBRyxFQUFFLEFBQUM7WUFDbEIsS0FBSyxNQUFNLE1BQU0sSUFBSSxDQUFBLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQSxDQUFFO2dCQUN4RCxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksVUFBVSxFQUFFO29CQUMvQixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztpQkFDNUI7YUFDRjtZQUNELE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FDekIsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLHNCQUFzQixDQUFDLENBQ25ELENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBTSxFQUFFLENBQUMsQ0FBQztTQUNwQjtLQUNGLENBQUMsRUFBRSxDQUFDO0lBQ0wsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO0NBQzdDIn0=