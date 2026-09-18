import { NextResponse } from 'next/server';
import { contentDisposition, parseDownloadId, readDownload } from '@/lib/downloads.js';
import { corsHeaders } from '@/lib/cors.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request, { params }) {
  const { id: raw } = await params;
  const id = parseDownloadId(raw);
  if (!id) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: corsHeaders });

  let record;
  try {
    record = await readDownload(id);
  } catch (err) {
    console.error('[d] failed to read download:', err);
    return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: corsHeaders });
  }
  if (!record) return NextResponse.json({ error: 'This download has expired or does not exist.' }, { status: 404, headers: corsHeaders });

  const headers = {
    'Content-Type': record.mimeType || 'application/pdf',
    'Content-Disposition': contentDisposition(record.fileName),
    'Cache-Control': 'private, max-age=300',
    'X-Download-Expires': new Date(record.expiresAt).toISOString(),
    ...corsHeaders,
  };
  if (typeof record.bytes === 'number') headers['Content-Length'] = String(record.bytes);
  if (record.etag) headers.ETag = `"${record.etag}"`;

  return new NextResponse(record.body, { status: 200, headers });
}
