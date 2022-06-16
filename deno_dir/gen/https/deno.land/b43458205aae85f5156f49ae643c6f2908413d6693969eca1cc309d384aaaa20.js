// Copyright since 2020, FranckLdx. All rights reserved. MIT license.
import { deferred } from "./deps.ts";
export const asyncDecorator = (fn)=>{
    return ()=>{
        const promise = deferred();
        try {
            const result = fn();
            promise.resolve(result);
        } catch (err) {
            promise.reject(err);
        }
        return promise;
    };
};
export const assertDefined = (value, errMsg)=>{
    if (value === undefined || value == null) {
        throw new Error(errMsg);
    }
    return true;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcmV0cnlAdjIuMC4wL21pc2MudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IHNpbmNlIDIwMjAsIEZyYW5ja0xkeC4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBkZWZlcnJlZCB9IGZyb20gXCIuL2RlcHMudHNcIjtcblxuZXhwb3J0IGNvbnN0IGFzeW5jRGVjb3JhdG9yID0gPFQ+KGZuOiAoKSA9PiBUKSA9PiB7XG4gIHJldHVybiAoKTogUHJvbWlzZTxUPiA9PiB7XG4gICAgY29uc3QgcHJvbWlzZSA9IGRlZmVycmVkPFQ+KCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICBwcm9taXNlLnJlc29sdmUocmVzdWx0KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHByb21pc2UucmVqZWN0KGVycik7XG4gICAgfVxuICAgIHJldHVybiBwcm9taXNlO1xuICB9O1xufTtcblxuZXhwb3J0IGNvbnN0IGFzc2VydERlZmluZWQgPSA8VD4oXG4gIHZhbHVlOiBUIHwgdW5kZWZpbmVkIHwgbnVsbCxcbiAgZXJyTXNnOiBzdHJpbmcsXG4pOiB2YWx1ZSBpcyBUID0+IHtcbiAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJNc2cpO1xuICB9XG4gIHJldHVybiB0cnVlO1xufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxRUFBcUU7QUFDckUsU0FBUyxRQUFRLFFBQVEsV0FBVyxDQUFDO0FBRXJDLE9BQU8sTUFBTSxjQUFjLEdBQUcsQ0FBSSxFQUFXLEdBQUs7SUFDaEQsT0FBTyxJQUFrQjtRQUN2QixNQUFNLE9BQU8sR0FBRyxRQUFRLEVBQUssQUFBQztRQUM5QixJQUFJO1lBQ0YsTUFBTSxNQUFNLEdBQUcsRUFBRSxFQUFFLEFBQUM7WUFDcEIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN6QixDQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNyQjtRQUNELE9BQU8sT0FBTyxDQUFDO0tBQ2hCLENBQUM7Q0FDSCxDQUFDO0FBRUYsT0FBTyxNQUFNLGFBQWEsR0FBRyxDQUMzQixLQUEyQixFQUMzQixNQUFjLEdBQ0M7SUFDZixJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxJQUFJLElBQUksRUFBRTtRQUN4QyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ3pCO0lBQ0QsT0FBTyxJQUFJLENBQUM7Q0FDYixDQUFDIn0=