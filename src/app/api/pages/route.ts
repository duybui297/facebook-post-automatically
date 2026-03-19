import { NextResponse } from 'next/server';

/**
 * GET /api/pages
 * Returns the default fanpages from the FANPAGES_DEFAULT environment variable.
 * This allows fanpages to persist across deployments without a database.
 */
export async function GET() {
  try {
    const raw = process.env.FANPAGES_DEFAULT;
    if (!raw) {
      return NextResponse.json({ pages: [] });
    }
    const pages = JSON.parse(raw);
    return NextResponse.json({ pages });
  } catch {
    return NextResponse.json({ pages: [], error: 'Failed to parse FANPAGES_DEFAULT env var' });
  }
}
