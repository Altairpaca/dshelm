import { AuthContractError } from './errors.ts'
import type { AuthAdapter, AuthInteraction, AuthProbeContext, AuthStatusResult } from './contracts.ts'

export class AuthRegistry {
  private readonly adapters = new Map<string, AuthAdapter>()

  register(adapter: AuthAdapter): void {
    if (this.adapters.has(adapter.resourceId)) {
      throw new AuthContractError('duplicate-resource', `Auth resource "${adapter.resourceId}" is already registered`)
    }
    this.adapters.set(adapter.resourceId, adapter)
  }

  list(): readonly AuthAdapter[] {
    return [...this.adapters.values()].sort((left, right) => left.resourceId.localeCompare(right.resourceId))
  }

  async probe(context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    const statuses = await Promise.all(this.list().map((adapter) => adapter.probe(context)))
    return flattenAndSort(statuses)
  }

  async status(context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    const statuses = await Promise.all(this.list().map((adapter) => adapter.status(context)))
    return flattenAndSort(statuses)
  }

  async login(resourceId: string, methodId: string, interaction: AuthInteraction, context: AuthProbeContext): Promise<AuthStatusResult> {
    return this.adapter(resourceId).login(methodId, interaction, context)
  }

  async logout(resourceId: string, methodId: string, context: AuthProbeContext): Promise<AuthStatusResult> {
    return this.adapter(resourceId).logout(methodId, context)
  }

  private adapter(resourceId: string): AuthAdapter {
    const adapter = this.adapters.get(resourceId)
    if (adapter === undefined) throw new AuthContractError('unknown-resource', `Unknown auth resource "${resourceId}"`)
    return adapter
  }
}

function flattenAndSort(statuses: readonly (readonly AuthStatusResult[])[]): readonly AuthStatusResult[] {
  return statuses.flat().sort((left, right) => {
    const resource = left.resourceId.localeCompare(right.resourceId)
    return resource === 0 ? left.methodId.localeCompare(right.methodId) : resource
  })
}
