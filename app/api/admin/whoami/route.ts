import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET(request: Request) {
  const user = await requireAdmin(request)
  return NextResponse.json({ isAdmin: !!user, email: user?.email ?? null })
}
