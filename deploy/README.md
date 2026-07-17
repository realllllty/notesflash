# Local public PWA deployment

The production PWA is served by an unprivileged Nginx process on
`127.0.0.1:4174`. A Cloudflare Quick Tunnel provides the public HTTPS URL.

```bash
npm run build
systemctl --user reload notesflash-pwa.service
journalctl --user -u notesflash-tunnel.service -n 50 --no-pager
```

Do not restart `notesflash-tunnel.service` for normal frontend updates. A Quick
Tunnel receives a new public hostname when it is recreated; the Nginx service
serves the rebuilt `dist/` files without requiring a tunnel restart.

The `trycloudflare.com` hostname is temporary and can change when a new quick
tunnel is created. Replace the quick tunnel with a named tunnel or an Nginx
virtual host after assigning a permanent DNS name.
