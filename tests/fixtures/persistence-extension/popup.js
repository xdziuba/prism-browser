const value = document.querySelector('#value');
const save = document.querySelector('#save');

async function showSavedValue() {
  const result = await chrome.storage.local.get('probe');
  value.textContent = result.probe ?? 'No probe saved yet.';
}

save.addEventListener('click', async () => {
  const probe = crypto.randomUUID();
  await chrome.storage.local.set({ probe });
  value.textContent = probe;
});

showSavedValue().catch((error) => {
  value.textContent = `Storage failed: ${error.message}`;
});
