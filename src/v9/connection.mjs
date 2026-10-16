// Metadata reads are safe to retry. Activity writes retain their own request IDs.
export async function connectApi(base, { fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), onWaiting = () => {} } = {}) {
  const tries = base ? 5 : 1;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const response = await fetcher(base + '/api/v9/meta', { signal: AbortSignal.timeout(base ? 20000 : 8000) });
      if (!response.ok) throw new Error('API unavailable');
      const meta = await response.json();
      if (!meta.ok || !['local', 'production'].includes(meta.mode)) throw new Error('Invalid API');
      return meta;
    } catch (error) {
      if (attempt === tries - 1) throw error;
      onWaiting(); await pause(2000);
    }
  }
}
