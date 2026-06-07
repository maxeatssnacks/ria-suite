import { type NextRequest, NextResponse } from 'next/server'
import { getWorkos, WORKOS_CLIENT_ID, WORKOS_REDIRECT_URI } from '@/lib/workos'

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get('redirect') ?? '/dashboard'

  const authorizationUrl = getWorkos().userManagement.getAuthorizationUrl({
    clientId: WORKOS_CLIENT_ID(),
    redirectUri: WORKOS_REDIRECT_URI(),
    provider: 'authkit',
    state: redirect,
  })

  return NextResponse.redirect(authorizationUrl)
}
