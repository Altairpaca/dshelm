export { EnvironmentApiKeyAuthAdapter, LibraryOAuthAuthAdapter, NativeProductAuthAdapter } from './adapters.ts'
export { AuthContractError } from './errors.ts'
export { AuthRegistry } from './registry.ts'
export { CredentialRef, credentialRef } from './contracts.ts'
export type {
  AuthAdapter,
  AuthInteraction,
  AuthMethod,
  AuthMethodKind,
  AuthOwner,
  AuthProbeContext,
  AuthStatus,
  AuthStatusResult,
  CommandResult,
  CommandSpec,
  EnvironmentApiKeyAuthAdapterOptions,
  LibraryOAuthAuthAdapterOptions,
  LibraryOAuthDriver,
  LibraryOAuthStatus,
  NativeProductAuthAdapterOptions,
  ProductCommandRunner,
} from './contracts.ts'
