const profileInput = document.getElementById("profileInput");
const startBtn = document.getElementById("startBtn");
const status = document.getElementById("status");

// fake extractor (replace with extension / bookmarklet logic)
function extractFirstVideoLinks() {
  // THIS ARRAY will normally come from:
  // - extension content script
  // - bookmarklet
  // - injected script

  return [
    "https://www.tiktok.com/@user/video/123",
    "https://www.tiktok.com/@user/video/456",
    "https://www.tiktok.com/@user/video/789"
  ];
}

startBtn.addEventListener("click", () => {
  const profileUrl = profileInput.value.trim();

  if (!profileUrl.includes("tiktok.com/@")) {
    alert("❌ Invalid TikTok profile URL");
    return;
  }

  status.textContent = "Collecting videos...";

  const videoLinks = extractFirstVideoLinks();

  if (!videoLinks.length) {
    status.textContent = "❌ No videos found";
    return;
  }

  // 🔥 PASS LINKS TO MULTI DOWNLOADER
  sendToMultiDownloader(videoLinks);
});

function sendToMultiDownloader(links) {
  // Example: inject into existing input logic
  const joined = links.join("\n");

  // If multi downloader is on same page:
  if (window.parent && window.parent.document) {
    const input = window.parent.document.getElementById("linkInput");
    if (input) {
      input.value = joined;
      input.dispatchEvent(new Event("input"));
      status.textContent = "✅ Videos loaded into downloader";
      return;
    }
  }

  // Or redirect with POST / session storage
  sessionStorage.setItem("multiLinks", joined);
  window.location.href = "multi-download.html";
}
