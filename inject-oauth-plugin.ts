import type { UserConfig, PluginOption } from 'vite';
import metadata from './public/oauth/client-metadata.json' with { type: 'json' };

export const SERVER_HOST = '127.0.0.1';
export const SERVER_PORT = 3003;

const WEB_PROD_REDIRECT_URI = metadata.redirect_uris.find(uri => uri === metadata.client_uri);
const EXT_CALLBACK_REDIRECT_URI = metadata.redirect_uris.find(uri => uri.endsWith('/oauth/callback'));
const FF_EXT_CALLBACK_REDIRECT_URI = metadata.redirect_uris.find(uri => uri.endsWith('/ff/oauth/callback'));

if (!WEB_PROD_REDIRECT_URI) {
    throw new Error("Could not find the main web redirect URI (matching client_uri) in client-metadata.json");
  }
if (!EXT_CALLBACK_REDIRECT_URI) {
    throw new Error("Could not find the extension callback redirect URI (.../oauth/callback) in client-metadata.json");
}
if (!FF_EXT_CALLBACK_REDIRECT_URI) {
  throw new Error("Could not find the Firefox extension callback redirect URI (.../ff/oauth/callback) in client-metadata.json");
}

export function injectOauthEnv(isForExtension: boolean, browser?: string): PluginOption {
  return {
    name: 'inject-oauth-env',
    config: (_config: UserConfig, { command }: { command: string }) => {
      let define = {};
      let clientId = metadata.client_id;
      let redirectUri: string;

      if (isForExtension) {
        if (browser === 'firefox') {
          redirectUri = FF_EXT_CALLBACK_REDIRECT_URI!;
        } else if (browser === 'chrome' || browser === 'edge' || browser === 'opera') {
          redirectUri = EXT_CALLBACK_REDIRECT_URI!;
        } else {
          console.warn(`[injectOauthEnv] Unknown browser target "${browser}" for extension build. Falling back to default callback URI.`);
          redirectUri = EXT_CALLBACK_REDIRECT_URI!;
        }
      } else {
        if (command === 'build') {
          redirectUri = WEB_PROD_REDIRECT_URI!;
        } else {
          // Web dev uses derived local redirect URI based on the production web URI's path
          const webDevPath = new URL(WEB_PROD_REDIRECT_URI!).pathname; // Get path like '/'
          redirectUri = `http://${SERVER_HOST}:${SERVER_PORT}${webDevPath}`;
          // Construct local dev client ID only for web dev
          clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(metadata.scope)}`;
        }
      }

      define = {
        'import.meta.env.VITE_OAUTH_CLIENT_ID': JSON.stringify(clientId),
        'import.meta.env.VITE_OAUTH_REDIRECT_URI': JSON.stringify(redirectUri),
        'import.meta.env.VITE_OAUTH_SCOPE': JSON.stringify(metadata.scope),
      };

      return { define };
    },
  } as PluginOption;
}