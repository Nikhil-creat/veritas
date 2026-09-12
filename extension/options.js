const input = document.getElementById("apiBase");
const status = document.getElementById("status");

chrome.storage.sync.get("apiBase", (data) => {
  input.value = data.apiBase || "http://localhost:3000";
});

document.getElementById("save").addEventListener("click", () => {
  const value = input.value.trim().replace(/\/$/, "");
  chrome.storage.sync.set({ apiBase: value }, () => {
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 1500);
  });
});
