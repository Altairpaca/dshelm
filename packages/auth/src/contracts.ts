const AUTH_METHOD_KINDS = ['api-key', 'library-oauth', 'native-product', 'device-code', 'gateway'] as const
export type AuthMethodKind = (typeof AUTH_METHOD_KINDS)[number]

const AUTH_OWNERS = ['dshelm', 'provider', 'product', 'host', 'gateway', 'none'] as const
export type AuthOwner = (typeof AUTH_OWNERS)[number]

const AUTH_STATUSES = ['available', 'authenticated', 'expired', 'action-required', 'unsupported', 'unknown'] as const
export type AuthStatus = (typeof AUTH_STATUSES)[number]

/** Opaque reference to a credential owned by an adapter or its configured store. */
export class CredentialRef {
  readonly value: string

  private constructor(value: string) {
    this.value = value
    Object.freeze(this)
  }

  static from(value: string): CredentialRef {
    const normalized = value.trim()
    if (normalized.length === 0 || normalized.includes('\n') || normalized.includes('\r')) {
      throw new TypeError('credential reference must be a non-empty single-line value')
    }
    return new CredentialRef(normalized)
  }

  toString(): string {
    return this.value
  }
}

export function credentialRef(value: string): CredentialRef {
  return CredentialRef.from(value)
}

export interface AuthMethod {
  readonly id: string
  readonly kind: AuthMethodKind
  readonly owner: AuthOwner
  readonly interactive: boolean
  readonly headless: boolean
  readonly refreshOwner: AuthOwner
  readonly credentialStoreOwner: AuthOwner
  readonly supportsMultiAccount: boolean
}

export interface AuthProbeContext {
  readonly now: () => number
  readonly commandExists: (command: string) => Promise<boolean>
  readonly env: (name: string) => string | undefined
}

export interface AuthInteraction {
  readonly notify: (event: { readonly type: 'info' | 'progress' | 'auth-url'; readonly message: string; readonly url?: string }) => void
  readonly prompt?: (prompt: {
    readonly type: 'text' | 'secret' | 'device-code' | 'select'
    readonly message: string
    readonly options?: readonly { readonly id: string; readonly label: string; readonly description?: string }[]
  }) => Promise<string>
}

export interface AuthStatusResult {
  readonly resourceId: string
  readonly product: string
  readonly methodId: string
  readonly authOwner: AuthOwner
  readonly status: AuthStatus
  readonly detail: string
  readonly credentialRef?: CredentialRef
  readonly expiresAt?: number
}

export interface AuthAdapter {
  readonly resourceId: string
  readonly product: string
  readonly methods: readonly AuthMethod[]
  probe(context: AuthProbeContext): Promise<readonly AuthStatusResult[]>
  status(context: AuthProbeContext): Promise<readonly AuthStatusResult[]>
  login(methodId: string, interaction: AuthInteraction, context: AuthProbeContext): Promise<AuthStatusResult>
  logout(methodId: string, context: AuthProbeContext): Promise<AuthStatusResult>
}

export interface CommandSpec {
  readonly command: string
  readonly args: readonly string[]
  readonly interactive?: boolean
}

export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface ProductCommandRunner {
  run(spec: CommandSpec): Promise<CommandResult>
}

export interface LibraryOAuthStatus {
  readonly status: AuthStatus
  readonly detail: string
  readonly expiresAt?: number
}

/** Provider-owned OAuth driver; token material never crosses this interface. */
export interface LibraryOAuthDriver {
  status(): Promise<LibraryOAuthStatus>
  login(interaction: AuthInteraction): Promise<LibraryOAuthStatus>
  logout(): Promise<void>
}

export interface NativeProductAuthAdapterOptions {
  readonly resourceId: string
  readonly product: string
  readonly runner: ProductCommandRunner
  readonly probe: CommandSpec
  readonly status: CommandSpec
  readonly login: CommandSpec
  readonly logout: CommandSpec
  readonly method: AuthMethod
  readonly credential: CredentialRef
}

export interface LibraryOAuthAuthAdapterOptions {
  readonly resourceId: string
  readonly product: string
  readonly method: AuthMethod
  readonly credential: CredentialRef
  readonly driver: LibraryOAuthDriver
}

export interface EnvironmentApiKeyAuthAdapterOptions {
  readonly resourceId: string
  readonly product: string
  readonly method: AuthMethod
  readonly credential: CredentialRef
  readonly envVar: string
}
