/**
 * modal.js - K-Traditional Modern 프리미엄 비동기 모달 & 토스트 시스템
 * (AppModal.alert, AppModal.confirm, showToast)
 */
const AppModal = (function () {
  let modalContainer = null;

  function ensureModalDOM() {
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'appModalContainer';
      modalContainer.className = 'app-modal-overlay';
      modalContainer.innerHTML = `
        <div class="app-modal-dialog">
          <div class="app-modal-header">
            <span class="app-modal-stamp" id="appModalStamp">認可</span>
            <div class="app-modal-title-box">
              <span class="app-modal-icon" id="appModalIcon">ℹ️</span>
              <h3 class="app-modal-title" id="appModalTitle">알 림</h3>
            </div>
          </div>
          <div class="app-modal-body" id="appModalBody"></div>
          <div class="app-modal-footer" id="appModalFooter"></div>
        </div>`;
      document.body.appendChild(modalContainer);
    }
  }

  return {
    alert: function (title, message, type = 'info') {
      return new Promise((resolve) => {
        ensureModalDOM();
        const iconMap = { info: '💡', warn: '⚠️', success: '🌸', error: '🚨' };
        const stampMap = { info: '通告', warn: '注意', success: '慶祝', error: '警報' };

        document.getElementById('appModalIcon').textContent = iconMap[type] || '💡';
        document.getElementById('appModalStamp').textContent = stampMap[type] || '通告';
        document.getElementById('appModalTitle').textContent = title;
        document.getElementById('appModalBody').innerHTML = message.replace(/\n/g, '<br>');

        const footer = document.getElementById('appModalFooter');
        footer.innerHTML = `<button type="button" class="btn-modal-primary" id="btnModalOk">확 인</button>`;

        modalContainer.classList.add('active');
        const btnOk = document.getElementById('btnModalOk');
        btnOk.focus();

        btnOk.onclick = () => {
          modalContainer.classList.remove('active');
          resolve(true);
        };
      });
    },

    confirm: function (title, message, options = {}) {
      return new Promise((resolve) => {
        ensureModalDOM();
        const icon = options.icon || '❓';
        const stamp = options.stamp || '確信';
        const okText = options.okText || '확 인';
        const cancelText = options.cancelText || '취 소';
        const isDanger = options.danger || false;

        document.getElementById('appModalIcon').textContent = icon;
        document.getElementById('appModalStamp').textContent = stamp;
        document.getElementById('appModalTitle').textContent = title;
        document.getElementById('appModalBody').innerHTML = message.replace(/\n/g, '<br>');

        const footer = document.getElementById('appModalFooter');
        footer.innerHTML = `
          <button type="button" class="btn-modal-cancel" id="btnModalCancel">${cancelText}</button>
          <button type="button" class="${isDanger ? 'btn-modal-danger' : 'btn-modal-primary'}" id="btnModalOk">${okText}</button>`;

        modalContainer.classList.add('active');
        const btnOk = document.getElementById('btnModalOk');
        const btnCancel = document.getElementById('btnModalCancel');
        btnCancel.focus();

        btnOk.onclick = () => {
          modalContainer.classList.remove('active');
          resolve(true);
        };
        btnCancel.onclick = () => {
          modalContainer.classList.remove('active');
          resolve(false);
        };
      });
    }
  };
})();

// 토스트 메시지 함수
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <span class="toast-stamp">${type === 'success' ? '慶' : type === 'warn' ? '注' : '訊'}</span>
    <span class="toast-text">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // 애니메이션 나타남
  setTimeout(() => toast.classList.add('show'), 10);

  // 3.2초 후 제거
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
