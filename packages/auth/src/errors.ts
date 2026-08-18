export type AuthErrorCode = 'duplicate-resource' | 'unknown-resource' | 'unknown-method' | 'unsupported-operation'

export class AuthContractError extends Error {
  override readonly name = 'AuthContractError'

  constructor(readonly code: AuthErrorCode, message: string) {
    super(message)
  }
}
