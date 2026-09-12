const VERDICT_LABEL = { clear: "CLEAR", caution: "CAUTION", flagged: "FLAGGED" };

chrome.storage.local.get(["lastResult", "lastImageUrl", "lastCheckedAt"], (data) => {
  const container = document.getElementById("content");
  if (!data.lastResult) return;

  const { score, confidence, summary, signals } = data.lastResult;

  const signalsHtml = (signals || [])
    .map(
      (s) => `
      <div class="signal">
        <strong>${s.title}</strong>
        <span class="tag ${s.verdict}">${VERDICT_LABEL[s.verdict] || s.verdict}</span>
      </div>`
    )
    .join("");

  container.innerHTML = `
    <p class="score">${score}<span style="font-size:14px;color:#64748b"> /100</span></p>
    <p class="confidence">${confidence} confidence</p>
    <p class="summary">${summary}</p>
    ${signalsHtml}
  `;
});
