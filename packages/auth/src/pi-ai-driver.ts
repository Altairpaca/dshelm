import type { Models } from '@earendil-works/pi-ai'
import { AuthContractError } from './errors.ts'
import type { AuthInteraction, LibraryOAuthDriver } from './contracts.ts'

export interface PiAiOAuthDriverOptions {
  readonly models: Pick<Models, 'checkAuth' | 'login' | 'logout'>
  readonly providerId: string
}

export function createPiAiOAuthDriver(options: PiAiOAuthDriverOptions): LibraryOAuthDriver {
  return {
    async status() {
      try {
        const auth = await options.models.checkAuth(options.providerId)
        return auth?.type === 'oauth'
          ? { status: 'authenticated', detail: 'pi-ai reports oauth credentials are configured' }
          : { status: 'action-required', detail: 'pi-ai reports no oauth credential for this provider' }
      } catch (error) {
        if (error instanceof Error) return { status: 'unknown', detail: 'pi-ai auth status failed' }
        throw error
      }
    },
    async login(interaction) {
      if (interaction.prompt === undefined) {
        throw new AuthContractError('unsupported-operation', 'pi-ai OAuth login requires an interactive prompt')
      }
      try {
        const credential = await options.models.login(options.providerId, 'oauth', {
          prompt: async (prompt) => interaction.prompt?.({
            type: prompt.type === 'manual_code' ? 'device-code' : prompt.type,
            message: prompt.message,
            ...(prompt.type === 'select' ? { options: prompt.options } : {}),
          }) ?? Promise.reject(new AuthContractError('unsupported-operation', 'pi-ai OAuth login prompt is unavailable')),
          notify: (event) => interaction.notify(toAuthEvent(event)),
        })
        return {
          status: 'authenticated',
          detail: 'pi-ai OAuth login completed',
          ...(credential.type === 'oauth' ? { expiresAt: credential.expires } : {}),
        }
      } catch (error) {
        if (error instanceof Error) return { status: 'unknown', detail: 'pi-ai OAuth login failed' }
        throw error
      }
    },
    async logout() {
      await options.models.logout(options.providerId)
    },
  }
}

function toAuthEvent(event: { readonly type: string; readonly message?: string; readonly url?: string; readonly instructions?: string; readonly userCode?: string; readonly verificationUri?: string }): { readonly type: 'info' | 'progress' | 'auth-url'; readonly message: string; readonly url?: string } {
  if (event.type === 'auth_url' && event.url !== undefined) return { type: 'auth-url', message: event.instructions ?? 'Open the provider login URL', url: event.url }
  if (event.type === 'progress') return { type: 'progress', message: event.message ?? 'Provider OAuth login in progress' }
  if (event.type === 'device_code') return { type: 'auth-url', message: `Device code ${event.userCode ?? ''} at ${event.verificationUri ?? ''}`.trim() }
  return { type: 'info', message: event.message ?? 'Provider OAuth login update' }
}
