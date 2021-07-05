export let defaultRetryOptions = {
    delay: 250,
    maxTry: 4 * 60,
    until: null,
};
export function setDefaultRetryOptions(retryOptions) {
    defaultRetryOptions = { ...defaultRetryOptions, ...retryOptions };
    return getDefaultRetryOptions();
}
export function getDefaultRetryOptions() {
    return { ...defaultRetryOptions };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBa0JBLE1BQU0sQ0FBQyxJQUFJLG1CQUFtQixHQUFzQjtJQUNsRCxLQUFLLEVBQUUsR0FBRztJQUNWLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRTtJQUNkLEtBQUssRUFBRSxJQUFJO0NBQ1osQ0FBQztBQUdGLE1BQU0sVUFBVSxzQkFBc0IsQ0FDcEMsWUFBc0M7SUFFdEMsbUJBQW1CLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUFFLEdBQUcsWUFBWSxFQUFFLENBQUM7SUFDbEUsT0FBTyxzQkFBc0IsRUFBRSxDQUFDO0FBQ2xDLENBQUM7QUFHRCxNQUFNLFVBQVUsc0JBQXNCO0lBQ3BDLE9BQU8sRUFBRSxHQUFHLG1CQUFtQixFQUFFLENBQUM7QUFDcEMsQ0FBQyJ9