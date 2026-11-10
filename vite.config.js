import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  return {
    base: './', // Relative base for GitHub Pages and iframe portability
    server: {
      port: 3000,
      host: true, // Listen on all local IPs (e.g. 192.168.x.x for Quest VR headset testing)
      open: true
    },
    plugins: [
      basicSsl()
    ]
  };
});
