# Tailscale Local Deployment Checklist

## Goal

Run the language learning app from the always-on Windows PC and access it privately from other devices through Tailscale.

This is the first deployment target. Hetzner and Netlify are later options and are not part of this checklist.

## Recommended Shape

```text
Windows PC
  -> Next.js app on localhost:3000
  -> FastAPI speech service on 127.0.0.1:8001
  -> SQLite database
  -> local image assets and generated content

Tailscale
  -> private remote access from approved devices
```

Do not expose the speech service publicly. Keep `LOCAL_SPEECH_URL=http://127.0.0.1:8001`.

## Inputs Needed

- [ ] Windows username.
- [ ] Target repo path, recommended: `C:\language-learning-mvp`.
- [ ] Target data path, recommended: `C:\language-learning-data`.
- [ ] Target config path, recommended: `C:\language-learning-config`.
- [ ] Confirm Tailscale is installed on the Windows PC.
- [ ] Confirm the Windows PC is signed into the correct Tailnet.
- [ ] Confirm the Windows PC Tailscale device name or MagicDNS hostname.
- [ ] Confirm access should be Tailscale-only, not public Funnel.
- [ ] Decide run mode:
  - [ ] Manual start.
  - [ ] Auto-start after reboot.
- [ ] Confirm whether `SESSION_SECRET` should be generated.
- [ ] OpenCode Go API key, base URL, and model name if content jobs should use LLM generation.
- [ ] Optional ElevenLabs Arabic TTS key and voice ID if cloud Arabic TTS should stay enabled.
- [ ] Windows PC CPU, RAM, and GPU details.

## Windows Prerequisites

- [ ] Install Git.
- [ ] Install Node.js LTS.
- [ ] Install Python 3.10 or newer.
- [ ] Install `ffmpeg` and make sure it is available in `PATH`.
- [ ] Install Tailscale.
- [ ] Sign into Tailscale.
- [ ] Enable MagicDNS in Tailscale admin if not already enabled.
- [ ] Verify the PC is reachable from another Tailscale device.

## App Setup

- [ ] Clone or copy the repo to `C:\language-learning-mvp`.
- [ ] Create `C:\language-learning-data`.
- [ ] Create `C:\language-learning-config`.
- [ ] Create production env file under `C:\language-learning-config`.
- [ ] Set `DATABASE_URL` to a SQLite file under `C:\language-learning-data`.
- [ ] Set `LOCAL_SPEECH_URL=http://127.0.0.1:8001`.
- [ ] Install Node dependencies with `npm install`.
- [ ] Run Prisma migration with `npm run db:migrate`.
- [ ] Seed app data with `npm run db:seed`.
- [ ] Seed or fetch image vocab assets:
  - [ ] `npm run data:seed:images`
  - [ ] `npm run image-vocab:prepare -- --language zh_hans --limit 12`
  - [ ] `npm run image-vocab:fetch -- --manifest data/image-vocab-batch.zh_hans.json`
  - [ ] `npm run image-vocab:chunks -- --manifest data/image-vocab-batch.zh_hans.json`

## Speech Service Setup

- [ ] Install speech Python dependencies through `npm run speech:dev` once.
- [ ] Confirm `ffmpeg` is found by the speech service.
- [ ] Start speech service.
- [ ] Verify health locally:

```powershell
curl http://127.0.0.1:8001/health
```

## Local Verification

- [ ] Start the app:

```powershell
npm run dev
```

- [ ] Open `http://localhost:3000` on the Windows PC.
- [ ] Log in.
- [ ] Open `/zh`.
- [ ] Confirm Image Vocab appears.
- [ ] Reveal and grade an image vocab card.
- [ ] Click `Bad image` on a test card and confirm it is removed from active image vocab.
- [ ] Open `/ar`.
- [ ] Confirm Arabic Image Vocab appears.
- [ ] Confirm speech health in the app shows online.

## Tailscale Verification

- [ ] From another Tailscale device, open:

```text
http://<windows-device-name>:3000
```

- [ ] If MagicDNS is unavailable, use the Windows PC Tailscale IP:

```text
http://<tailscale-ip>:3000
```

- [ ] Confirm login works from the remote device.
- [ ] Confirm `/zh` loads from the remote device.
- [ ] Confirm `/ar` loads from the remote device.
- [ ] Confirm image assets load remotely.
- [ ] Confirm microphone permission works from the remote device browser.
- [ ] Confirm speech scoring works or fails with a clear local-service error.

## Auto-Start Option

Use Windows Task Scheduler or a Windows service wrapper after manual verification works.

- [ ] Add app start task.
- [ ] Add speech service start task.
- [ ] Set tasks to run after login or after reboot.
- [ ] Set working directory to `C:\language-learning-mvp`.
- [ ] Confirm both services restart after reboot.
- [ ] Confirm Tailscale reconnects after reboot.
- [ ] Confirm remote device can access the app after reboot.

## Backup Checklist

- [ ] Back up `C:\language-learning-data`.
- [ ] Back up `C:\language-learning-config` securely.
- [ ] Back up image assets if stored outside the repo.
- [ ] Test restoring the SQLite database to a temporary location.

## Security Checklist

- [ ] Keep access Tailscale-only for the first deployment.
- [ ] Do not enable Tailscale Funnel unless explicitly needed later.
- [ ] Do not expose `127.0.0.1:8001` publicly.
- [ ] Do not put API keys in `NEXT_PUBLIC_*` variables.
- [ ] Keep OpenCode Go and ElevenLabs keys server-side only.
- [ ] Use a strong `SESSION_SECRET`.
- [ ] Keep Windows updates enabled.

## Done Criteria

- [ ] App starts on the Windows PC.
- [ ] Speech service starts on the Windows PC.
- [ ] App is reachable from another approved Tailscale device.
- [ ] Login works remotely.
- [ ] Arabic and Mandarin pages work remotely.
- [ ] Image Vocab works remotely.
- [ ] Speech health is visible in the app.
- [ ] App and speech service can restart after reboot or with one documented command.
- [ ] Backups are configured for app data and secrets.
