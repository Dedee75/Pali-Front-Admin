import styles from "./dialog.module.css";

// Native modal dialogs provide focus trapping, keyboard support and a backdrop.
let dialogOpen = false;

function openDialog(message: string, action?: 'update' | 'delete'): Promise<boolean> {
  if (dialogOpen) return Promise.resolve(false);
  dialogOpen = true;
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = `${styles.dialog} ${action === 'delete' ? styles.danger : ''}`;
    dialog.setAttribute('aria-labelledby', 'app-dialog-title');
    dialog.setAttribute('aria-describedby', 'app-dialog-message');
    const icon = document.createElement('div');
    icon.className = styles.icon;
    icon.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', action === 'delete'
      ? 'M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6'
      : action === 'update'
        ? 'M12 20h9M16 3l5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-3L3 17v4Z'
        : 'M9 12l2 2 4-4M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0');
    svg.append(path);
    icon.append(svg);
    const title = document.createElement('h2');
    title.className = styles.title;
    title.id = 'app-dialog-title';
    title.textContent = action === 'delete' ? 'Confirm delete' : action === 'update' ? 'Confirm update' : 'Notice';
    const description = document.createElement('p');
    description.className = styles.description;
    description.id = 'app-dialog-message';
    description.textContent = message;
    const buttons = document.createElement('div');
    buttons.className = styles.actions;
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = `${styles.button} ${styles.primary}`;
    accept.textContent = action === 'delete' ? 'Delete' : action === 'update' ? 'Update' : 'OK';
    let accepted = false;
    accept.onclick = () => { accepted = true; dialog.close(); };
    if (action) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = styles.button;
      cancel.textContent = 'Cancel';
      cancel.autofocus = true;
      cancel.onclick = () => dialog.close();
      buttons.append(cancel);
    } else {
      accept.autofocus = true;
    }
    buttons.append(accept);
    dialog.append(icon, title, description, buttons);
    dialog.addEventListener('close', () => {
      dialog.remove();
      dialogOpen = false;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      resolve(accepted);
    }, { once: true });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") event.stopPropagation();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function confirmAction(action: 'update' | 'delete', subject: string) {
  return openDialog(`Are you sure you want to ${action} ${subject}?`, action);
}

export function showMessage(message: string) {
  return openDialog(message);
}
