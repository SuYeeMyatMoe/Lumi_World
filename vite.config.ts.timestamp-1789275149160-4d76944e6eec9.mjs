// vite.config.ts
import { defineConfig } from "file:///C:/Su%20Yee's%20External%20Projects/Lumi_World/node_modules/vite/dist/node/index.js";
import { fileURLToPath, URL } from "node:url";
import react from "file:///C:/Su%20Yee's%20External%20Projects/Lumi_World/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///C:/Su%20Yee's%20External%20Projects/Lumi_World/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest.config.ts
import { defineManifest } from "file:///C:/Su%20Yee's%20External%20Projects/Lumi_World/node_modules/@crxjs/vite-plugin/dist/index.mjs";
var manifest_config_default = defineManifest({
  manifest_version: 3,
  name: "Lumi World",
  description: "Lumi \u2014 AI that understands what you mean. Point at something and Lumi understands.",
  version: "0.1.0",
  action: { default_title: "Open Lumi" },
  permissions: ["storage", "scripting", "sidePanel", "tabs"],
  host_permissions: ["http://*/*", "https://*/*", "https://api.openai.com/*"],
  background: { service_worker: "src/background/index.ts", type: "module" },
  side_panel: { default_path: "src/sidepanel/index.html" },
  options_page: "src/options/index.html",
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle"
    }
  ],
  icons: {
    16: "public/icons/icon16.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png"
  }
});

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///C:/Su%20Yee's%20External%20Projects/Lumi_World/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    crx({
      manifest: manifest_config_default,
      contentScripts: {
        // HMR preamble opens a chrome.runtime port on every site. When Google
        // puts the tab in bfcache the port dies and CRXJS throws uncaught.
        preambleCode: false,
        // IIFE in `vite build` so websites never load vendor/vite-client.js.
        standaloneFiles: ["src/content/index.tsx"]
      }
    })
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)) }
  },
  build: {
    rollupOptions: {
      input: {
        sidepanel: "src/sidepanel/index.html",
        options: "src/options/index.html"
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { protocol: "ws", host: "localhost", port: 24678, clientPort: 24678 }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcU3UgWWVlJ3MgRXh0ZXJuYWwgUHJvamVjdHNcXFxcTHVtaV9Xb3JsZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcU3UgWWVlJ3MgRXh0ZXJuYWwgUHJvamVjdHNcXFxcTHVtaV9Xb3JsZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovU3UlMjBZZWUncyUyMEV4dGVybmFsJTIwUHJvamVjdHMvTHVtaV9Xb3JsZC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGNyeCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbic7XG5pbXBvcnQgbWFuaWZlc3QgZnJvbSAnLi9tYW5pZmVzdC5jb25maWcnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBjcngoe1xuICAgICAgbWFuaWZlc3QsXG4gICAgICBjb250ZW50U2NyaXB0czoge1xuICAgICAgICAvLyBITVIgcHJlYW1ibGUgb3BlbnMgYSBjaHJvbWUucnVudGltZSBwb3J0IG9uIGV2ZXJ5IHNpdGUuIFdoZW4gR29vZ2xlXG4gICAgICAgIC8vIHB1dHMgdGhlIHRhYiBpbiBiZmNhY2hlIHRoZSBwb3J0IGRpZXMgYW5kIENSWEpTIHRocm93cyB1bmNhdWdodC5cbiAgICAgICAgcHJlYW1ibGVDb2RlOiBmYWxzZSxcbiAgICAgICAgLy8gSUlGRSBpbiBgdml0ZSBidWlsZGAgc28gd2Vic2l0ZXMgbmV2ZXIgbG9hZCB2ZW5kb3Ivdml0ZS1jbGllbnQuanMuXG4gICAgICAgIHN0YW5kYWxvbmVGaWxlczogWydzcmMvY29udGVudC9pbmRleC50c3gnXSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczogeyAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIHNpZGVwYW5lbDogJ3NyYy9zaWRlcGFuZWwvaW5kZXguaHRtbCcsXG4gICAgICAgIG9wdGlvbnM6ICdzcmMvb3B0aW9ucy9pbmRleC5odG1sJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhtcjogeyBwcm90b2NvbDogJ3dzJywgaG9zdDogJ2xvY2FsaG9zdCcsIHBvcnQ6IDI0Njc4LCBjbGllbnRQb3J0OiAyNDY3OCB9LFxuICB9LFxufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFN1IFllZSdzIEV4dGVybmFsIFByb2plY3RzXFxcXEx1bWlfV29ybGRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFN1IFllZSdzIEV4dGVybmFsIFByb2plY3RzXFxcXEx1bWlfV29ybGRcXFxcbWFuaWZlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9TdSUyMFllZSdzJTIwRXh0ZXJuYWwlMjBQcm9qZWN0cy9MdW1pX1dvcmxkL21hbmlmZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcblxuLy8gTGVhc3QtcHJpdmlsZWdlIHRyYWRlb2ZmOiB0aGUgTWluaSBNb2RlIG1hc2NvdCBtdXN0IGF1dG8taW5qZWN0IG9uIGV2ZXJ5IHBhZ2UsXG4vLyB3aGljaCByZXF1aXJlcyBzdGF0aWMgY29udGVudF9zY3JpcHRzIG1hdGNoZXMuIGFjdGl2ZVRhYiBjYW5ub3QgZG8gdGhhdC5cbi8vIFVzZXJzIGNhbiBwYXVzZSBMdW1pIHBlci1vcmlnaW4gZnJvbSB0aGUgT3B0aW9ucyBwYWdlIChsdW1pU2V0dGluZ3MuZGlzYWJsZWRPcmlnaW5zKS5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZU1hbmlmZXN0KHtcbiAgbWFuaWZlc3RfdmVyc2lvbjogMyxcbiAgbmFtZTogJ0x1bWkgV29ybGQnLFxuICBkZXNjcmlwdGlvbjogJ0x1bWkgXHUyMDE0IEFJIHRoYXQgdW5kZXJzdGFuZHMgd2hhdCB5b3UgbWVhbi4gUG9pbnQgYXQgc29tZXRoaW5nIGFuZCBMdW1pIHVuZGVyc3RhbmRzLicsXG4gIHZlcnNpb246ICcwLjEuMCcsXG4gIGFjdGlvbjogeyBkZWZhdWx0X3RpdGxlOiAnT3BlbiBMdW1pJyB9LFxuICBwZXJtaXNzaW9uczogWydzdG9yYWdlJywgJ3NjcmlwdGluZycsICdzaWRlUGFuZWwnLCAndGFicyddLFxuICBob3N0X3Blcm1pc3Npb25zOiBbJ2h0dHA6Ly8qLyonLCAnaHR0cHM6Ly8qLyonLCAnaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS8qJ10sXG4gIGJhY2tncm91bmQ6IHsgc2VydmljZV93b3JrZXI6ICdzcmMvYmFja2dyb3VuZC9pbmRleC50cycsIHR5cGU6ICdtb2R1bGUnIH0sXG4gIHNpZGVfcGFuZWw6IHsgZGVmYXVsdF9wYXRoOiAnc3JjL3NpZGVwYW5lbC9pbmRleC5odG1sJyB9LFxuICBvcHRpb25zX3BhZ2U6ICdzcmMvb3B0aW9ucy9pbmRleC5odG1sJyxcbiAgY29udGVudF9zY3JpcHRzOiBbXG4gICAge1xuICAgICAgbWF0Y2hlczogWydodHRwOi8vKi8qJywgJ2h0dHBzOi8vKi8qJ10sXG4gICAgICBqczogWydzcmMvY29udGVudC9pbmRleC50c3gnXSxcbiAgICAgIHJ1bl9hdDogJ2RvY3VtZW50X2lkbGUnLFxuICAgIH0sXG4gIF0sXG4gIGljb25zOiB7XG4gICAgMTY6ICdwdWJsaWMvaWNvbnMvaWNvbjE2LnBuZycsXG4gICAgNDg6ICdwdWJsaWMvaWNvbnMvaWNvbjQ4LnBuZycsXG4gICAgMTI4OiAncHVibGljL2ljb25zL2ljb24xMjgucG5nJyxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzVCxTQUFTLG9CQUFvQjtBQUNuVixTQUFTLGVBQWUsV0FBVztBQUNuQyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxXQUFXOzs7QUNIMFMsU0FBUyxzQkFBc0I7QUFLN1YsSUFBTywwQkFBUSxlQUFlO0FBQUEsRUFDNUIsa0JBQWtCO0FBQUEsRUFDbEIsTUFBTTtBQUFBLEVBQ04sYUFBYTtBQUFBLEVBQ2IsU0FBUztBQUFBLEVBQ1QsUUFBUSxFQUFFLGVBQWUsWUFBWTtBQUFBLEVBQ3JDLGFBQWEsQ0FBQyxXQUFXLGFBQWEsYUFBYSxNQUFNO0FBQUEsRUFDekQsa0JBQWtCLENBQUMsY0FBYyxlQUFlLDBCQUEwQjtBQUFBLEVBQzFFLFlBQVksRUFBRSxnQkFBZ0IsMkJBQTJCLE1BQU0sU0FBUztBQUFBLEVBQ3hFLFlBQVksRUFBRSxjQUFjLDJCQUEyQjtBQUFBLEVBQ3ZELGNBQWM7QUFBQSxFQUNkLGlCQUFpQjtBQUFBLElBQ2Y7QUFBQSxNQUNFLFNBQVMsQ0FBQyxjQUFjLGFBQWE7QUFBQSxNQUNyQyxJQUFJLENBQUMsdUJBQXVCO0FBQUEsTUFDNUIsUUFBUTtBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxJQUFJO0FBQUEsSUFDSixJQUFJO0FBQUEsSUFDSixLQUFLO0FBQUEsRUFDUDtBQUNGLENBQUM7OztBRDVCNEwsSUFBTSwyQ0FBMkM7QUFNOU8sSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sSUFBSTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGdCQUFnQjtBQUFBO0FBQUE7QUFBQSxRQUdkLGNBQWM7QUFBQTtBQUFBLFFBRWQsaUJBQWlCLENBQUMsdUJBQXVCO0FBQUEsTUFDM0M7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPLEVBQUUsS0FBSyxjQUFjLElBQUksSUFBSSxTQUFTLHdDQUFlLENBQUMsRUFBRTtBQUFBLEVBQ2pFO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixPQUFPO0FBQUEsUUFDTCxXQUFXO0FBQUEsUUFDWCxTQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixLQUFLLEVBQUUsVUFBVSxNQUFNLE1BQU0sYUFBYSxNQUFNLE9BQU8sWUFBWSxNQUFNO0FBQUEsRUFDM0U7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
