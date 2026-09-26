// Keep recovery independent of React: a failed dependency must never leave an empty page.
void import("./main").catch(() => {
  const title = document.getElementById("startup-title");
  const message = document.getElementById("startup-message");
  if (title) title.textContent = "Let’s try that again.";
  if (message)
    message.textContent =
      "BizTrust couldn’t load its application files. Reload to get the latest version.";
});
