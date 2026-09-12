chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "veritas-check-image",
    title: "Check with Veritas",
    contexts: ["image"]
  });
});

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get("apiBase");
  return apiBase || "http://localhost:3000";
}

async function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "veritas-check-image" || !info.srcUrl) return;

  try {
    const imageResponse = await fetch(info.srcUrl);
    if (!imageResponse.ok) throw new Error("Could not fetch that image (it may block cross-origin reads).");
    const blob = await imageResponse.blob();

    const formData = new FormData();
    formData.append("file", blob, "image.jpg");

    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/analyze-image`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed.");

    await chrome.storage.local.set({
      lastResult: data,
      lastImageUrl: info.srcUrl,
      lastCheckedAt: Date.now()
    });

    await notify(`Veritas: ${data.score}/100 trust score`, data.summary);
  } catch (err) {
    await notify(
      "Veritas check failed",
      err.message || "Could not reach the Veritas API — check the extension options for the correct URL."
    );
  }
});
