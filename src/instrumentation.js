export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensurePdfJsDom } = await import('./lib/pdf/pdfjs-dom.js');
    ensurePdfJsDom();
  }
}
