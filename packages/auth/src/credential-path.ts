import { homedir } from 'node:os'
import { join } from 'node:path'

export function defaultCredentialStorePath(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.DSHELM_CONFIG_DIR?.trim()
  if (configured !== undefined && configured.length > 0) return join(configured, 'credentials', 'credentials.json')
  if (process.platform === 'win32') {
    const appData = environment.APPDATA?.trim()
    return join(appData === undefined || appData.length === 0 ? join(homedir(), 'AppData', 'Roaming') : appData, 'dshelm', 'credentials', 'credentials.json')
  }
  const xdg = environment.XDG_CONFIG_HOME?.trim()
  return join(xdg === undefined || xdg.length === 0 ? join(homedir(), '.config') : xdg, 'dshelm', 'credentials', 'credentials.json')
}
