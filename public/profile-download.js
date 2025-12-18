const profileInput = document.getElementById("profileInput");
const startBtn = document.getElementById("startBtn");
const status = document.getElementById("status");

startBtn.addEventListener("click", async () => {
  const profileUrl = profileInput.value.trim();

  if (!profileUrl.includes("tiktok.com/@")) {
    alert("Invalid TikTok profile URL");
    return;
  }

  status.textContent = "Fetching profile videos...";

  try {
    const res = await fetch(
      `/profile?url=${encodeURIComponent(profileUrl)}`
    );
    const json = await res.json();

    if (!json.links || !json.links.length) {
      status.textContent = "No videos found";
      return;
    }

    status.textContent = `${json.links.length} videos found. Redirecting...`;

    // Redirect to multi downloader
    window.location.href =
      "download.html?links=" +
      encodeURIComponent(json.links.join("\n"));

  } catch (e) {
    status.textContent = "Failed to load profile";
  }
});
