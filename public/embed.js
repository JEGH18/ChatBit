// Uso: <script src="https://TU-DOMINIO.vercel.app/embed.js" defer></script>
// Agrega un botón flotante que abre el asistente de registro en un panel.
(() => {
  if (window.__neocreditoChat) return;
  window.__neocreditoChat = true;

  const origin = new URL(document.currentScript.src).origin;
  const style = document.createElement('style');
  style.textContent = `
    .neo-chat-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;
      padding:12px 18px;border:0;border-radius:999px;background:#22ddb6;color:#232147;font:700 15px/1 system-ui,sans-serif;
      box-shadow:0 6px 18px rgba(35,33,71,.28);cursor:pointer}
    .neo-chat-btn:focus-visible{outline:3px solid #4b4a7c;outline-offset:2px}
    .neo-chat-frame{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:min(420px,calc(100vw - 40px));
      height:min(680px,calc(100vh - 110px));border:0;border-radius:16px;box-shadow:0 12px 40px rgba(35,33,71,.35);
      background:#4b4a7c;display:none}
    .neo-chat-frame.open{display:block}
    @media (max-width:520px){.neo-chat-frame{inset:0;width:100%;height:100%;border-radius:0}}`;
  document.head.append(style);

  const frame = document.createElement('iframe');
  frame.className = 'neo-chat-frame';
  frame.title = 'Asistente de registro Neocrédito';
  frame.loading = 'lazy';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'neo-chat-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = 'Solicita tu crédito';

  btn.addEventListener('click', () => {
    if (!frame.src) frame.src = `${origin}/?embed=1`;
    const open = frame.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Cerrar' : 'Solicita tu crédito';
  });

  document.body.append(frame, btn);
})();
