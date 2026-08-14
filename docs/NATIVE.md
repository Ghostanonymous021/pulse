# Pulse — contentor nativo (Capacitor)

**Estado:** Fase 1 — contentor da origem web  
**Produto:** o Next.js em producao. O binario nao reimplementa UI.  
**Flutter:** fora de ambito. Nao misturar.

## Porque live URL e nao `output: 'export'`

A app e App Router com:

- middleware de sessao (`@supabase/ssr`, cookies)
- Server Components + `requireProfile`
- BFF em `/api/*` (ranking, signup, media, FCM)
- CSRF `assertSameOrigin` nas mutacoes

Um HTML empacotado em `capacitor://localhost` torna a sessao cross-origin.
Cookies SameSite nao viajam, o signup recusa a origem, o ranking deixa de
ter utilizador. Essa via esta fechada.

O WebView navega em `https://pulseax.vercel.app`. A origem do documento e
a mesma do browser. Auth, RLS e BFF nao mudam.

## Mapa

| Camada | Onde |
|--------|------|
| UI + BFF | Next.js (este repo), deploy Vercel |
| Deteccao nativa | `src/lib/native/runtime.ts` |
| Boot de plugins | `src/components/native/native-shell.tsx` |
| SW / install PWA | `PwaRegister` — no-op + unregister no nativo |
| Web Push toggle | escondido no nativo (FCM e Fase 2) |
| Config do shell | `capacitor.config.ts` |
| Fallback sem rede | `native/www/index.html` |
| Android | `android/` (gerado pelo CLI) |

## Origem

```
PULSE_NATIVE_ORIGIN=https://pulseax.vercel.app   # default
```

Usar so o dominio custom. Aliases `*.vercel.app` do projecto estao
atras de SSO da Vercel — o WebView ficaria num login da Vercel, nao do Pulse.

Preview: apontar `PULSE_NATIVE_ORIGIN` a um deploy publico e `npx cap sync`.

## Comandos

```bash
npm install
npx cap add android    # uma vez
npx cap add ios        # uma vez, em macOS
npm run native:sync
npm run native:android # Android Studio
```

O `webDir` (`native/www`) so existe porque o CLI exige uma pasta. Em
runtime o WebView carrega `server.url`. Sem rede, o utilizador ve o
HTML de fallback — nao um clone da app.

## O que o web faz de diferente no WebView

1. Nao regista `sw.js`. Se houver SW antigo, desregista e apaga caches `pulse-pwa-*`.
2. `NativeShell` pinta `data-pulse-native` no `<html>`, overlay da status bar,
   teclado sem resize do WebView (`useKeyboardInset` continua a mandar),
   esconde o splash, back Android sai nas raizes (`/`, `/home`, `/login`, `/signup`).
3. Toggle VAPID nao aparece. Push nativo e `POST /api/push/device` (Fase 2).
4. Copy do microfone fala em "definicoes da app".

Estas mudancas tem de estar **deployadas** na origem antes do APK
fazer sentido. O binario sozinho nao desliga o SW.

## Permissoes (Fase 1)

Android (`android/app/src/main/AndroidManifest.xml`): câmara, microfone,
imagens, `POST_NOTIFICATIONS`. Runtime so quando o WebView pede
(`<input capture>`, `getUserMedia`). Sem cleartext. `allowBackup=false`.

iOS (`ios/App/App/Info.plist`): `NSCameraUsageDescription`,
`NSMicrophoneUsageDescription`, `NSPhotoLibrary*`. Sem as strings, o
`<input>` falha em silencio. `pod install` e o build exigem macOS.

Orientacao: portrait (igual ao manifest PWA).

## Fase 2 (nao feita)

- `@capacitor/push-notifications` + Firebase → `/api/push/device`
- Universal Links / App Links (`/p/:id`, `/u/:username`, `/mensagens/:id`)
- Share sheet no menu do post
- Bearer opcional no BFF (hoje so cookie — suficiente para este contentor)

## Fase 3

- Confirmar que `pulseax.vercel.app` serve o commit com `NativeShell`
- Crash reporting
- Store listings / Data safety

## Regras

- `service_role` nunca entra no binario
- Ranking continua no servidor
- Nao adicionar `capacitor://localhost` a `ALLOWED_ORIGINS`
- Nao ligar `server.cleartext`
- Nao commitar keystores
