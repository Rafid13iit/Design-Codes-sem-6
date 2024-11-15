// script.js
class RateLimiterDemo {
  constructor() {
    this.requestButton = document.getElementById("sendRequest");
    this.responseArea = document.getElementById("response");
    this.remainingSpan = document.getElementById("remaining");
    this.limitSpan = document.getElementById("limit");
    this.retryAfterSpan = document.getElementById("retryAfter");

    this.isRequestPending = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.requestButton.addEventListener("click", () =>
      this.sendSingleRequest()
    );
    document
      .getElementById("loadTest")
      .addEventListener("click", () => this.runLoadTest());
    document
      .getElementById("raceTest")
      .addEventListener("click", () => this.testRaceCondition());
  }

  async sendSingleRequest() {
    if (this.isRequestPending) return;
    this.isRequestPending = true;

    try {
      const response = await fetch("http://localhost:3000/api/data");
      this.updateUI(response);
      const data = await response.text();
      this.appendToLog(`Response: ${data}`);
    } catch (error) {
      this.appendToLog(`Error: ${error.message}`);
    } finally {
      this.isRequestPending = false;
    }
  }

  async runLoadTest() {
    this.appendToLog("Starting load test...");

    let successCount = 0;
    let rateLimitedCount = 0;
    let errorCount = 0;

    const requests = Array(250)
      .fill()
      .map(() =>
        fetch("http://localhost:3000/api/data")
          .then((response) => {
            if (response.status === 429) {
              rateLimitedCount++;
              this.appendToLog(
                `Request rate limited (Retry-After: ${response.headers.get(
                  "X-RateLimit-Retry-After"
                )}s)`
              );
            } else {
              successCount++;
            }
            this.updateUI(response);
          })
          .catch((error) => {
            errorCount++;
            this.appendToLog(`Error: ${error.message}`);
          })
      );

    await Promise.all(requests);

    this.appendToLog(`Load test results:
    - Successful: ${successCount}
    - Rate limited: ${rateLimitedCount}
    - Errors: ${errorCount}
    - Total: ${successCount + rateLimitedCount + errorCount}`);
  }

  async testRaceCondition() {
    this.appendToLog("Testing race condition...");

    let successCount = 0;
    let rateLimitedCount = 0;
    let errorCount = 0;

    const requests = Array(20)
      .fill()
      .map(() =>
        fetch("http://localhost:3000/api/data")
          .then((response) => {
            this.updateUI(response);
            if (response.status === 429) {
              rateLimitedCount++;
              this.appendToLog(
                `Request rate limited (Retry-After: ${response.headers.get(
                  "X-RateLimit-Retry-After"
                )}s)`
              );
            } else {
              successCount++;
            }
            return response.status;
          })
          .catch((error) => {
            errorCount++;
            this.appendToLog(`Error: ${error.message}`);
            return "error";
          })
      );

    await Promise.all(requests);

    this.appendToLog(`Race condition test results:
    - Successful: ${successCount}
    - Rate limited: ${rateLimitedCount}
    - Errors: ${errorCount}
    - Total requests: 20
    - Success rate: ${((successCount / 20) * 100).toFixed(1)}%`);
  }

  updateUI(response) {
    this.remainingSpan.textContent =
      response.headers.get("X-RateLimit-Remaining") || "N/A";
    this.limitSpan.textContent =
      response.headers.get("X-RateLimit-Limit") || "N/A";
    this.retryAfterSpan.textContent =
      response.headers.get("X-RateLimit-Retry-After") || "N/A";
  }

  appendToLog(message) {
    const timestamp = new Date().toISOString();
    this.responseArea.innerHTML += `\n[${timestamp}] ${message}`;
    this.responseArea.scrollTop = this.responseArea.scrollHeight;
  }
}

// Initialize the demo when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new RateLimiterDemo();
});
