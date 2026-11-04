// The data tests read the Bibles from the local copy: brings it up to date from the Blob store.
import { fetchBibles } from '../scripts/fetch-bibles';

export default async function setup(): Promise<void> {
    await fetchBibles({ log: console.log });
}
