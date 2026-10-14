// Pause between page requests so we don't hammer the upstream APIs.
export const PAGE_DELAY_MS = 1000;

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sleep 1 second between page requests. */
export const pageDelay = () => wait(PAGE_DELAY_MS);
