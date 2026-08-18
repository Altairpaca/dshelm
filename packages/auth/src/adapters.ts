import { AuthContractError } from './errors.ts'
import type {
  AuthAdapter,
  AuthInteraction,
  AuthMethod,
  AuthProbeContext,
  AuthStatus,
  AuthStatusResult,
  EnvironmentApiKeyAuthAdapterOptions,
  LibraryOAuthAuthAdapterOptions,
  NativeProductAuthAdapterOptions,
  ProductCommandRunner,
  CommandSpec,
} from './contracts.ts'

function statusResult(
  resourceId: string,
  product: string,
  method: AuthMethod,
  status: AuthStatus,
  detail: string,
  credential: AuthStatusResult['credentialRef'],
  expiresAt?: number,
): AuthStatusResult {
  return {
    resourceId,
    product,
    methodId: method.id,
    authOwner: method.owner,
    status,
    detail,
    ...(credential === undefined ? {} : { credentialRef: credential }),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  }
}

async function runCommand(runner: ProductCommandRunner, spec: CommandSpec): Promise<{ readonly result?: { readonly exitCode: number }; readonly failed: boolean }> {
  try {
    const result = await runner.run(spec)
    return { result, failed: false }
  } catch (error) {
    if (error instanceof Error) return { failed: true }
    throw error
  }
}

function requireMethod(methods: readonly AuthMethod[], methodId: string): AuthMethod {
  const method = methods.find((entry) => entry.id === methodId)
  if (method === undefined) {
    throw new AuthContractError('unknown-method', `Unknown auth method "${methodId}"`)
  }
  return method
}

export class NativeProductAuthAdapter implements AuthAdapter {
  readonly resourceId: string
  readonly product: string
  readonly methods: readonly AuthMethod[]
  private readonly options: NativeProductAuthAdapterOptions

  constructor(options: NativeProductAuthAdapterOptions) {
    this.options = options
    this.resourceId = options.resourceId
    this.product = options.product
    this.methods = [options.method]
  }

  async probe(_context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    const outcome = await runCommand(this.options.runner, this.options.probe)
    return [statusResult(
      this.resourceId,
      this.product,
      this.options.method,
      outcome.failed || outcome.result?.exitCode !== 0 ? 'unknown' : 'available',
      outcome.failed ? 'product CLI probe failed' : 'product CLI detected',
      this.options.credential,
    )]
  }

  async status(context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    const probe = await this.probe(context)
    const probeStatus = probe[0]
    if (probeStatus?.status === 'unknown') return probe
    const outcome = await runCommand(this.options.runner, this.options.status)
    const status: AuthStatus = outcome.failed
      ? 'unknown'
      : outcome.result?.exitCode === 0 ? 'authenticated' : 'action-required'
    return [statusResult(
      this.resourceId,
      this.product,
      this.options.method,
      status,
      status === 'authenticated' ? 'product reports an authenticated account' : 'product login is required',
      this.options.credential,
    )]
  }

  async login(methodId: string, _interaction: AuthInteraction, _context: AuthProbeContext): Promise<AuthStatusResult> {
    const method = requireMethod(this.methods, methodId)
    if (!method.interactive) throw new AuthContractError('unsupported-operation', `Auth method "${methodId}" is not interactive`)
    const outcome = await runCommand(this.options.runner, this.options.login)
    return statusResult(
      this.resourceId,
      this.product,
      method,
      outcome.failed ? 'unknown' : outcome.result?.exitCode === 0 ? 'authenticated' : 'action-required',
      outcome.failed ? 'product login command failed' : outcome.result?.exitCode === 0 ? 'product login completed' : 'product login requires action',
      this.options.credential,
    )
  }

  async logout(methodId: string, _context: AuthProbeContext): Promise<AuthStatusResult> {
    const method = requireMethod(this.methods, methodId)
    const outcome = await runCommand(this.options.runner, this.options.logout)
    return statusResult(
      this.resourceId,
      this.product,
      method,
      outcome.failed ? 'unknown' : outcome.result?.exitCode === 0 ? 'available' : 'action-required',
      outcome.failed ? 'product logout command failed' : outcome.result?.exitCode === 0 ? 'product account logged out' : 'product logout requires action',
      this.options.credential,
    )
  }
}

export class LibraryOAuthAuthAdapter implements AuthAdapter {
  readonly resourceId: string
  readonly product: string
  readonly methods: readonly AuthMethod[]
  private readonly options: LibraryOAuthAuthAdapterOptions

  constructor(options: LibraryOAuthAuthAdapterOptions) {
    this.options = options
    this.resourceId = options.resourceId
    this.product = options.product
    this.methods = [options.method]
  }

  async probe(context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    return this.status(context)
  }

  async status(_context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    try {
      const result = await this.options.driver.status()
      return [statusResult(this.resourceId, this.product, this.options.method, result.status, result.detail, this.options.credential, result.expiresAt)]
    } catch (error) {
      if (error instanceof Error) {
        return [statusResult(this.resourceId, this.product, this.options.method, 'unknown', 'provider auth status failed', this.options.credential)]
      }
      throw error
    }
  }

  async login(methodId: string, interaction: AuthInteraction, _context: AuthProbeContext): Promise<AuthStatusResult> {
    const method = requireMethod(this.methods, methodId)
    if (!method.interactive) throw new AuthContractError('unsupported-operation', `Auth method "${methodId}" is not interactive`)
    try {
      const result = await this.options.driver.login(interaction)
      return statusResult(this.resourceId, this.product, method, result.status, result.detail, this.options.credential, result.expiresAt)
    } catch (error) {
      if (error instanceof Error) return statusResult(this.resourceId, this.product, method, 'unknown', 'provider OAuth login failed', this.options.credential)
      throw error
    }
  }

  async logout(methodId: string, _context: AuthProbeContext): Promise<AuthStatusResult> {
    const method = requireMethod(this.methods, methodId)
    try {
      await this.options.driver.logout()
      return statusResult(this.resourceId, this.product, method, 'available', 'provider OAuth credential removed', this.options.credential)
    } catch (error) {
      if (error instanceof Error) return statusResult(this.resourceId, this.product, method, 'unknown', 'provider OAuth logout failed', this.options.credential)
      throw error
    }
  }
}

export class EnvironmentApiKeyAuthAdapter implements AuthAdapter {
  readonly resourceId: string
  readonly product: string
  readonly methods: readonly AuthMethod[]
  private readonly options: EnvironmentApiKeyAuthAdapterOptions

  constructor(options: EnvironmentApiKeyAuthAdapterOptions) {
    this.options = options
    this.resourceId = options.resourceId
    this.product = options.product
    this.methods = [options.method]
  }

  async probe(context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    const configured = (context.env(this.options.envVar)?.trim().length ?? 0) > 0
    return [statusResult(
      this.resourceId,
      this.product,
      this.options.method,
      configured ? 'authenticated' : 'available',
      configured ? 'host environment credential is present' : 'host environment credential is not configured',
      this.options.credential,
    )]
  }

  async status(context: AuthProbeContext): Promise<readonly AuthStatusResult[]> {
    const statuses = await this.probe(context)
    const current = statuses[0]
    if (current === undefined || current.status === 'authenticated') return statuses
    return [statusResult(
      this.resourceId,
      this.product,
      this.options.method,
      'action-required',
      'set the host environment credential before execution',
      this.options.credential,
    )]
  }

  async login(methodId: string, _interaction: AuthInteraction, _context: AuthProbeContext): Promise<AuthStatusResult> {
    const method = requireMethod(this.methods, methodId)
    throw new AuthContractError('unsupported-operation', `Auth method "${method.id}" is host-managed; set ${this.options.envVar}`)
  }

  async logout(methodId: string, _context: AuthProbeContext): Promise<AuthStatusResult> {
    const method = requireMethod(this.methods, methodId)
    throw new AuthContractError('unsupported-operation', `Auth method "${method.id}" is host-managed; unset ${this.options.envVar}`)
  }
}
