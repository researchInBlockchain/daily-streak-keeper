// Sends the current leetcode.com login cookies to the local LeetCode Daily Agent
// (via Chrome/Edge native messaging) whenever they change, at browser start-up,
// and every 6 hours. The cookies never leave this computer.

const HOST = "com.leetcode_daily_agent.cookie_sync";
const URL = "https://leetcode.com";
let timer = null;

async function sync() {
  const [session, csrf] = await Promise.all([
    chrome.cookies.get({ url: URL, name: "LEETCODE_SESSION" }),
    chrome.cookies.get({ url: URL, name: "csrftoken" }),
  ]);
  if (!session || !csrf || !session.value) return; // logged out: nothing to send
  chrome.runtime.sendNativeMessage(
    HOST,
    { leetcode_session: session.value, csrftoken: csrf.value },
    (resp) => {
      if (chrome.runtime.lastError) {
        console.warn("cookie sync failed:", chrome.runtime.lastError.message);
      } else {
        console.log("cookie sync:", resp);
      }
    }
  );
}

// csrftoken is re-issued often; wait a moment so a burst of changes syncs once.
function syncSoon() {
  clearTimeout(timer);
  timer = setTimeout(sync, 3000);
}

chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
  if (removed || !cookie.domain.endsWith("leetcode.com")) return;
  if (cookie.name === "LEETCODE_SESSION" || cookie.name === "csrftoken") syncSoon();
});
chrome.runtime.onStartup.addListener(sync);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("sync", { periodInMinutes: 360 });
  sync();
});
chrome.alarms.onAlarm.addListener(sync);
