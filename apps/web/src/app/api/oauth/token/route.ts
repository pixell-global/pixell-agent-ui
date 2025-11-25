/**
 * POST /api/oauth/token
 *
 * Internal API for PAF Core Agent to get decrypted tokens
 * Protected by service token authentication
 *
 * This endpoint should NEVER be exposed to the frontend.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceToken } from '@/lib/auth/service-token'
import { externalAccountsManager } from '@/lib/oauth/external-accounts-manager'
import type { OAuthProvider } from '@/lib/oauth/providers/types'

export async function POST(req: NextRequest) {
  // Authenticate with service token - only orchestrator/PAF Core can call this
  const authResult = requireServiceToken(req)
  if (authResult) return authResult

  try {
    const body = await req.json()
    const { orgId, accountId, provider } = body

    if (!orgId || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId and provider' },
        { status: 400 }
      )
    }

    let targetAccountId = accountId

    // If no specific account ID provided, get the default account for this provider
    if (!targetAccountId) {
      const defaultAccount = await externalAccountsManager.getDefaultAccount(
        orgId,
        provider as OAuthProvider
      )

      if (!defaultAccount) {
        return NextResponse.json(
          {
            error: 'No connected account found',
            needsAuth: true,
            provider,
          },
          { status: 404 }
        )
      }

      targetAccountId = defaultAccount.id
    }

    // Validate token is still valid before returning
    const isValid = await externalAccountsManager.validateToken(targetAccountId, orgId)

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Token expired or invalid',
          needsReauth: true,
          accountId: targetAccountId,
        },
        { status: 401 }
      )
    }

    // Get decrypted token
    const token = await externalAccountsManager.getDecryptedToken(targetAccountId, orgId)

    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    // Return token (never log this!)
    return NextResponse.json({
      token,
      accountId: targetAccountId,
    })
  } catch (error) {
    console.error('[OAuth Token] Error getting token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/oauth/token
 *
 * Get list of available accounts for a provider (without tokens)
 * Used by orchestrator to show account selection
 */
export async function GET(req: NextRequest) {
  // Authenticate with service token
  const authResult = requireServiceToken(req)
  if (authResult) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const provider = searchParams.get('provider') as OAuthProvider | null

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orgId' },
        { status: 400 }
      )
    }

    const accounts = await externalAccountsManager.getAccountsForOrg(
      orgId,
      provider || undefined
    )

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('[OAuth Token] Error listing accounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
