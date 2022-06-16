// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjk4LjAvYXN5bmMvcG9vbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIxIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vKipcbiAqIHBvb2xlZE1hcCB0cmFuc2Zvcm1zIHZhbHVlcyBmcm9tIGFuIChhc3luYykgaXRlcmFibGUgaW50byBhbm90aGVyIGFzeW5jXG4gKiBpdGVyYWJsZS4gVGhlIHRyYW5zZm9ybXMgYXJlIGRvbmUgY29uY3VycmVudGx5LCB3aXRoIGEgbWF4IGNvbmN1cnJlbmN5XG4gKiBkZWZpbmVkIGJ5IHRoZSBwb29sTGltaXQuXG4gKlxuICogSWYgYW4gZXJyb3IgaXMgdGhyb3duIGZyb20gYGl0ZXJhYmxlRm5gLCBubyBuZXcgdHJhbnNmb3JtYXRpb25zIHdpbGwgYmVnaW4uXG4gKiBBbGwgY3VycmVudGx5IGV4ZWN1dGluZyB0cmFuc2Zvcm1hdGlvbnMgYXJlIGFsbG93ZWQgdG8gZmluaXNoIGFuZCBzdGlsbFxuICogeWllbGRlZCBvbiBzdWNjZXNzLiBBZnRlciB0aGF0LCB0aGUgcmVqZWN0aW9ucyBhbW9uZyB0aGVtIGFyZSBnYXRoZXJlZCBhbmRcbiAqIHRocm93biBieSB0aGUgaXRlcmF0b3IgaW4gYW4gYEFnZ3JlZ2F0ZUVycm9yYC5cbiAqXG4gKiBAcGFyYW0gcG9vbExpbWl0IFRoZSBtYXhpbXVtIGNvdW50IG9mIGl0ZW1zIGJlaW5nIHByb2Nlc3NlZCBjb25jdXJyZW50bHkuXG4gKiBAcGFyYW0gYXJyYXkgVGhlIGlucHV0IGFycmF5IGZvciBtYXBwaW5nLlxuICogQHBhcmFtIGl0ZXJhdG9yRm4gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgZm9yIGV2ZXJ5IGl0ZW0gb2YgdGhlIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gcG9vbGVkTWFwPFQsIFI+KFxuICBwb29sTGltaXQ6IG51bWJlcixcbiAgYXJyYXk6IEl0ZXJhYmxlPFQ+IHwgQXN5bmNJdGVyYWJsZTxUPixcbiAgaXRlcmF0b3JGbjogKGRhdGE6IFQpID0+IFByb21pc2U8Uj4sXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8Uj4ge1xuICAvLyBDcmVhdGUgdGhlIGFzeW5jIGl0ZXJhYmxlIHRoYXQgaXMgcmV0dXJuZWQgZnJvbSB0aGlzIGZ1bmN0aW9uLlxuICBjb25zdCByZXMgPSBuZXcgVHJhbnNmb3JtU3RyZWFtPFByb21pc2U8Uj4sIFI+KHtcbiAgICBhc3luYyB0cmFuc2Zvcm0oXG4gICAgICBwOiBQcm9taXNlPFI+LFxuICAgICAgY29udHJvbGxlcjogVHJhbnNmb3JtU3RyZWFtRGVmYXVsdENvbnRyb2xsZXI8Uj4sXG4gICAgKSB7XG4gICAgICBjb250cm9sbGVyLmVucXVldWUoYXdhaXQgcCk7XG4gICAgfSxcbiAgfSk7XG4gIC8vIFN0YXJ0IHByb2Nlc3NpbmcgaXRlbXMgZnJvbSB0aGUgaXRlcmF0b3JcbiAgKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB3cml0ZXIgPSByZXMud3JpdGFibGUuZ2V0V3JpdGVyKCk7XG4gICAgY29uc3QgZXhlY3V0aW5nOiBBcnJheTxQcm9taXNlPHVua25vd24+PiA9IFtdO1xuICAgIHRyeSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgYXJyYXkpIHtcbiAgICAgICAgY29uc3QgcCA9IFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4gaXRlcmF0b3JGbihpdGVtKSk7XG4gICAgICAgIC8vIE9ubHkgd3JpdGUgb24gc3VjY2Vzcy4gSWYgd2UgYHdyaXRlci53cml0ZSgpYCBhIHJlamVjdGVkIHByb21pc2UsXG4gICAgICAgIC8vIHRoYXQgd2lsbCBlbmQgdGhlIGl0ZXJhdGlvbi4gV2UgZG9uJ3Qgd2FudCB0aGF0IHlldC4gSW5zdGVhZCBsZXQgaXRcbiAgICAgICAgLy8gZmFpbCB0aGUgcmFjZSwgdGFraW5nIHVzIHRvIHRoZSBjYXRjaCBibG9jayB3aGVyZSBhbGwgY3VycmVudGx5XG4gICAgICAgIC8vIGV4ZWN1dGluZyBqb2JzIGFyZSBhbGxvd2VkIHRvIGZpbmlzaCBhbmQgYWxsIHJlamVjdGlvbnMgYW1vbmcgdGhlbVxuICAgICAgICAvLyBjYW4gYmUgcmVwb3J0ZWQgdG9nZXRoZXIuXG4gICAgICAgIHAudGhlbigodikgPT4gd3JpdGVyLndyaXRlKFByb21pc2UucmVzb2x2ZSh2KSkpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgICAgY29uc3QgZTogUHJvbWlzZTx1bmtub3duPiA9IHAudGhlbigoKSA9PlxuICAgICAgICAgIGV4ZWN1dGluZy5zcGxpY2UoZXhlY3V0aW5nLmluZGV4T2YoZSksIDEpXG4gICAgICAgICk7XG4gICAgICAgIGV4ZWN1dGluZy5wdXNoKGUpO1xuICAgICAgICBpZiAoZXhlY3V0aW5nLmxlbmd0aCA+PSBwb29sTGltaXQpIHtcbiAgICAgICAgICBhd2FpdCBQcm9taXNlLnJhY2UoZXhlY3V0aW5nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gV2FpdCB1bnRpbCBhbGwgb25nb2luZyBldmVudHMgaGF2ZSBwcm9jZXNzZWQsIHRoZW4gY2xvc2UgdGhlIHdyaXRlci5cbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKGV4ZWN1dGluZyk7XG4gICAgICB3cml0ZXIuY2xvc2UoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IGVycm9ycyA9IFtdO1xuICAgICAgZm9yIChjb25zdCByZXN1bHQgb2YgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGV4ZWN1dGluZykpIHtcbiAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT0gXCJyZWplY3RlZFwiKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2gocmVzdWx0LnJlYXNvbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHdyaXRlci53cml0ZShQcm9taXNlLnJlamVjdChcbiAgICAgICAgbmV3IEFnZ3JlZ2F0ZUVycm9yKGVycm9ycywgXCJUaHJldyB3aGlsZSBtYXBwaW5nLlwiKSxcbiAgICAgICkpLmNhdGNoKCgpID0+IHt9KTtcbiAgICB9XG4gIH0pKCk7XG4gIHJldHVybiByZXMucmVhZGFibGVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFOzs7Ozs7Ozs7Ozs7O0dBYUcsQ0FDSCxPQUFPLFNBQVMsU0FBUyxDQUN2QixTQUFpQixFQUNqQixLQUFxQyxFQUNyQyxVQUFtQyxFQUNUO0lBQzFCLGlFQUFpRTtJQUNqRSxNQUFNLEdBQUcsR0FBRyxJQUFJLGVBQWUsQ0FBZ0I7UUFDN0MsTUFBTSxTQUFTLEVBQ2IsQ0FBYSxFQUNiLFVBQStDLEVBQy9DO1lBQ0EsVUFBVSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQzdCO0tBQ0YsQ0FBQyxBQUFDO0lBQ0gsMkNBQTJDO0lBQzNDLENBQUMsVUFBWTtRQUNYLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEFBQUM7UUFDeEMsTUFBTSxTQUFTLEdBQTRCLEVBQUUsQUFBQztRQUM5QyxJQUFJO1lBQ0YsV0FBVyxNQUFNLElBQUksSUFBSSxLQUFLLENBQUU7Z0JBQzlCLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBTSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQUFBQztnQkFDekQsb0VBQW9FO2dCQUNwRSxzRUFBc0U7Z0JBQ3RFLGtFQUFrRTtnQkFDbEUscUVBQXFFO2dCQUNyRSw0QkFBNEI7Z0JBQzVCLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBTSxFQUFFLENBQUMsQ0FBQztnQkFDaEUsTUFBTSxDQUFDLEdBQXFCLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFDakMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUMxQyxBQUFDO2dCQUNGLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xCLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxTQUFTLEVBQUU7b0JBQ2pDLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDL0I7YUFDRjtZQUNELHVFQUF1RTtZQUN2RSxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0IsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1NBQ2hCLENBQUMsT0FBTTtZQUNOLE1BQU0sTUFBTSxHQUFHLEVBQUUsQUFBQztZQUNsQixLQUFLLE1BQU0sTUFBTSxJQUFJLENBQUEsTUFBTSxPQUFPLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFBLENBQUU7Z0JBQ3hELElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxVQUFVLEVBQUU7b0JBQy9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUM1QjthQUNGO1lBQ0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUN6QixJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUUsc0JBQXNCLENBQUMsQ0FDbkQsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQ3BCO0tBQ0YsQ0FBQyxFQUFFLENBQUM7SUFDTCxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7Q0FDN0MifQ==