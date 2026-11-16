export const showPrompt = (container, message, isAlert = false) => {
    return new Promise((resolve) => {
        const promptOverlay = container.querySelector('#ht-custom-prompt');
        const msgEl = container.querySelector('#ht-prompt-message');
        const inputEl = container.querySelector('#ht-prompt-input');
        const btnOk = container.querySelector('#ht-prompt-ok');
        const btnCancel = container.querySelector('#ht-prompt-cancel');

        msgEl.textContent = message;
        inputEl.value = "";
        
        if (isAlert) {
            inputEl.style.display = 'none';
            btnCancel.style.display = 'none';
        } else {
            inputEl.style.display = 'block';
            btnCancel.style.display = 'block';
        }
        
        promptOverlay.classList.remove('ht-hidden');
        
        if (!isAlert) {
            setTimeout(() => inputEl.focus(), 50);
        } else {
            setTimeout(() => btnOk.focus(), 50);
        }

        const cleanup = () => {
            promptOverlay.classList.add('ht-hidden');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            inputEl.removeEventListener('keydown', onKey);
        };

        const onOk = () => { cleanup(); resolve(isAlert ? true : inputEl.value); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onKey = (e) => {
            if (e.key === 'Enter') onOk();
            if (e.key === 'Escape') onCancel();
        };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        inputEl.addEventListener('keydown', onKey);
    });
};

export const showConfirm = (container, message) => {
    return new Promise((resolve) => {
        const confirmOverlay = container.querySelector('#ht-confirm-prompt');
        const msgEl = container.querySelector('#ht-confirm-message');
        const btnOk = container.querySelector('#ht-confirm-ok');
        const btnCancel = container.querySelector('#ht-confirm-cancel');

        msgEl.innerHTML = message;
        confirmOverlay.classList.remove('ht-hidden');
        
        const cleanup = () => {
            confirmOverlay.classList.add('ht-hidden');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
};