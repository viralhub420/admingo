const tg = Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;
const API = "https://YOUR_RENDER_BACKEND_URL"; // পরে Replace করবে

const balanceEl = document.getElementById("balance");

// Register user on backend
fetch(API + "/user/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    telegramId: user.id,
    username: user.username
  })
}).then(() => {
  updateBalance();
});

function updateBalance() {
  fetch(API + "/user/register", { // এটা পরে /user/balance API করলে replace হবে
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: user.id })
  }).then(res => res.json())
    .then(data => {
      if (data.success) {
        balanceEl.innerText = "Balance: " + data.balance;
      }
    });
}

function watchAd() {
  fetch(API + "/ads/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: user.id })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert("🎉 +" + data.reward + " Points Added!");
      updateBalance();
    } else {
      alert(data.error);
    }
  });
}

function withdrawPoints() {
  const method = prompt("Withdraw Method (bKash, Nagad, USDT):");
  const amount = parseInt(prompt("Enter amount to withdraw:"), 10);

  fetch(API + "/withdraw/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: user.id, method, amount })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert("✅ " + data.message);
      updateBalance();
    } else {
      alert(data.error);
    }
  });
}
