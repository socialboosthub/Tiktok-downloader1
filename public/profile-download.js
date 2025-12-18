const profileInput = document.getElementById("profileInput");
const startBtn = document.getElementById("startBtn");
const status = document.getElementById("status");

/*
  TEMP extractor
  (later you replace this with real scraping / extension logic)
*/
function extractFirstVideoLinks() {
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

  status.textContent = `✅ ${videoLinks.length} videos found. Redirecting...`;

  // 🔥 SEND TO MULTI DOWNLOADER
  redirectToMulti(videoLinks);
});

function redirectToMulti(links) {
  const joined = links.join("\n");
  const encoded = encodeURIComponent(joined);

  // ✅ YOUR REAL MULTI DOWNLOADER FILE
  window.location.href = `download.html?links=${encoded}`;
}
