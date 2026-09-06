(() => {
  const injectedAttr = 'data-hw-instagram-conversations';

  async function loadConversations(root) {
    const select = root.querySelector('[data-hw-conversation-select]');
    const status = root.querySelector('[data-hw-conversation-status]');
    if (!select || !status) return;

    status.textContent = 'Loading conversations…';
    try {
      const response = await fetch('/api/instagram/conversations', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load Instagram conversations');

      select.innerHTML = '<option value="">Select a conversation</option>';
      for (const conversation of data.conversations || []) {
        const option = document.createElement('option');
        option.value = conversation.recipientId;
        option.textContent = conversation.username ? `@${conversation.username}` : conversation.name;
        select.appendChild(option);
      }

      status.textContent = data.conversations?.length
        ? `${data.conversations.length} conversation${data.conversations.length === 1 ? '' : 's'} found`
        : 'No conversations yet. Message Horizon Works from another Instagram account first.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Unable to load conversations';
    }
  }

  function enhanceCampaigns() {
    const input = [...document.querySelectorAll('input')].find((element) =>
      element.getAttribute('placeholder') === 'Paste the recipient ID from your webhook event',
    );
    if (!input) return;

    const form = input.closest('form');
    if (!form || form.getAttribute(injectedAttr) === 'true') return;
    form.setAttribute(injectedAttr, 'true');

    form.innerHTML = `
      <div class="panel-head">
        <div>
          <p class="section-kicker">Instagram Messaging API</p>
          <h3>Send a test DM</h3>
        </div>
        <span class="status-pill">Connected</span>
      </div>
      <div style="display:grid;gap:16px">
        <label>
          Recipient
          <select data-hw-conversation-select required style="width:100%;padding:12px 14px;border:1px solid #2a2a2a;border-radius:10px;background:#111;color:#fff">
            <option value="">Select a conversation</option>
          </select>
        </label>
        <p class="metric-meta" data-hw-conversation-status>Loading conversations…</p>
        <button type="button" class="ghost-btn" data-hw-refresh-conversations>Refresh conversations</button>
        <label>
          Message
          <textarea required maxLength="1000" rows="5" data-hw-message>Hi! This is a quick test message from Horizon Works.</textarea>
        </label>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="primary-btn" type="submit" data-hw-send>Send test DM <span>➤</span></button>
        </div>
        <div data-hw-send-result style="display:none;border:1px solid #2a2a2a;padding:16px;border-radius:10px;gap:6px;flex-direction:column"></div>
      </div>
    `;

    const refresh = () => loadConversations(form);
    form.querySelector('[data-hw-refresh-conversations]').addEventListener('click', refresh);
    refresh();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const recipientId = form.querySelector('[data-hw-conversation-select]')?.value?.trim();
      const message = form.querySelector('[data-hw-message]')?.value?.trim();
      const button = form.querySelector('[data-hw-send]');
      const result = form.querySelector('[data-hw-send-result]');
      if (!recipientId || !message) return;

      button.disabled = true;
      button.textContent = 'Sending…';
      result.style.display = 'none';

      try {
        const response = await fetch('/api/instagram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId, message }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Instagram rejected the message');

        result.style.display = 'flex';
        result.innerHTML = '<strong>Message sent</strong><span>Instagram accepted the message.</span>';
      } catch (error) {
        result.style.display = 'flex';
        result.innerHTML = `<strong>Send failed</strong><span>${String(error instanceof Error ? error.message : error).replace(/[&<>]/g, '')}</span>`;
      } finally {
        button.disabled = false;
        button.innerHTML = 'Send test DM <span>➤</span>';
      }
    });
  }

  const observer = new MutationObserver(() => enhanceCampaigns());
  observer.observe(document.body, { childList: true, subtree: true });
  enhanceCampaigns();
})();
