/* messages-ui.js — رابط کاربری پیام‌ها — v1.0 */
window.MessagesUI = {
  _currentTeacher: 'teacher',
  _currentClassCode: null,

  render() {
    const chat = document.getElementById('chat-container');
    if (!chat) return;
    const profile = ProfileManager.getActive();
    if (!profile) return;
    const conv = SocialCore.messages.getConversation(profile.profileId, this._currentTeacher);
    if (conv.length === 0) {
      chat.innerHTML = '<div class="chat-empty">هنوز پیامی رد و بدل نشده.</div>';
      return;
    }
    chat.innerHTML = '';
    conv.forEach(m => {
      const isMine = m.from === profile.profileId;
      const b = document.createElement('div');
      b.className = 'chat-bubble ' + (isMine ? 'from-me' : 'from-them');
      b.innerHTML = escapeHtml(m.text) + '<span class="chat-time">' + timeFa(m.sentAt) + '</span>';
      chat.appendChild(b);
    });
    chat.scrollTop = chat.scrollHeight;
  },

  send() {
    const profile = ProfileManager.getActive();
    if (!profile) return;
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = (input.value || '').trim();
    if (!text) return;
    SocialCore.messages.send(profile.profileId, this._currentTeacher, text, {
      classCode: this._currentClassCode || ''
    });
    input.value = '';
    this.render();
  },

  close() { document.getElementById('modal-messages').classList.add('hidden'); }
};
